import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/local";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { intakeLogs, inventoryTransactions, supplements } from "@/lib/db/schema";
import { isUuid, withUser } from "@/lib/db/with-user";
import { isIsoDate } from "@/lib/date";
import {
  adjustStock,
  restock,
  reverseIntake,
  takeIntake,
  type IntakeResult,
  type Result,
  type StockResult,
} from "@/lib/domain/ledger";
import { adjustInputSchema, restockInputSchema } from "@/lib/domain/validation";
import { issuesFromZod, notFound, validationFailed } from "@/lib/errors";
import { iso, toIntakeLog, toTransaction } from "@/lib/services/mappers";
import { lockSupplement } from "@/lib/services/supplements";
import type { TakeIntakeParams } from "@/lib/store/repository";
import { SCHEDULE_SLOTS } from "@/lib/types";

/**
 * 服用紀錄與庫存交易的資料庫層。
 * 每個操作都在 withUser 交易內：先鎖保健品列，套用 lib/domain/ledger 的純函式，再把紀錄、異動、庫存一起寫回。
 * 同一計畫項目重複勾選：純函式先擋，資料庫的部分唯一索引（intake_logs_taken_once_uq）再擋一次。
 */

export async function takeIntakeDb(db: Db, userId: string, params: TakeIntakeParams): Promise<Result<IntakeResult>> {
  if (!isIsoDate(params.planDate)) throw validationFailed([{ field: "planDate", message: "日期格式不正確" }]);
  if (!SCHEDULE_SLOTS.includes(params.slot)) throw validationFailed([{ field: "slot", message: "時段不正確" }]);
  const ordinal = Number.isInteger(params.ordinal) && params.ordinal >= 0 && params.ordinal < 10 ? params.ordinal : 0;

  try {
    return await withUser(db, userId, async (tx) => {
      const supplement = await lockSupplement(tx, userId, params.supplementId);
      // 計畫項目必須真的存在於該保健品的計畫中：時段要在 scheduleSlots 裡，序號不能超過該時段的次數
      const slotCount = supplement.scheduleSlots.filter((s) => s === params.slot).length;
      if (ordinal >= slotCount) {
        return { ok: false, error: { code: "INVALID_PLAN_ITEM", message: "這個時段不在此保健品的服用計畫中。" } };
      }
      const existing = await tx
        .select()
        .from(intakeLogs)
        .where(
          and(
            eq(intakeLogs.userId, userId),
            eq(intakeLogs.supplementId, supplement.id),
            eq(intakeLogs.planDate, params.planDate),
          ),
        );
      const r = takeIntake({
        supplement,
        planDate: params.planDate,
        slot: params.slot,
        ordinal,
        existingLogs: existing.map(toIntakeLog),
        allowInsufficientStock: params.allowInsufficientStock === true,
      });
      if (!r.ok) return r;
      const [logRow] = await tx
        .insert(intakeLogs)
        .values({ ...r.value.log, userId })
        .returning();
      const [txRow] = await tx
        .insert(inventoryTransactions)
        .values({ ...r.value.transaction, userId })
        .returning();
      await tx
        .update(supplements)
        .set({ stockQuantity: r.value.supplement.stockQuantity })
        .where(and(eq(supplements.id, supplement.id), eq(supplements.userId, userId)));
      return {
        ok: true,
        value: { supplement: r.value.supplement, log: toIntakeLog(logRow), transaction: toTransaction(txRow) },
      };
    });
  } catch (error) {
    if (isUniqueViolation(error, "intake_logs_taken_once_uq")) {
      return { ok: false, error: { code: "ALREADY_TAKEN", message: "這一筆今天已經記錄過了。" } };
    }
    throw error;
  }
}

export async function reverseIntakeDb(db: Db, userId: string, logId: string): Promise<Result<IntakeResult>> {
  if (!isUuid(logId)) throw notFound("服用紀錄");
  return withUser(db, userId, async (tx) => {
    const [logRow] = await tx
      .select()
      .from(intakeLogs)
      .where(and(eq(intakeLogs.id, logId), eq(intakeLogs.userId, userId)))
      .for("update");
    if (!logRow) throw notFound("服用紀錄");
    const supplement = await lockSupplement(tx, userId, logRow.supplementId);
    const r = reverseIntake({ supplement, log: toIntakeLog(logRow) });
    if (!r.ok) return r;
    const [updated] = await tx
      .update(intakeLogs)
      .set({ status: "reversed", reversedAt: r.value.log.reversedAt })
      .where(and(eq(intakeLogs.id, logId), eq(intakeLogs.userId, userId), eq(intakeLogs.status, "taken")))
      .returning();
    if (!updated) return { ok: false, error: { code: "ALREADY_REVERSED", message: "這筆紀錄已經撤銷過了。" } };
    const [txRow] = await tx
      .insert(inventoryTransactions)
      .values({ ...r.value.transaction, userId })
      .returning();
    await tx
      .update(supplements)
      .set({ stockQuantity: r.value.supplement.stockQuantity })
      .where(and(eq(supplements.id, supplement.id), eq(supplements.userId, userId)));
    return {
      ok: true,
      value: { supplement: r.value.supplement, log: toIntakeLog(updated), transaction: toTransaction(txRow) },
    };
  });
}

export async function restockDb(
  db: Db,
  userId: string,
  supplementId: string,
  input: unknown,
): Promise<Result<StockResult>> {
  const parsed = restockInputSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  return withUser(db, userId, async (tx) => {
    const supplement = await lockSupplement(tx, userId, supplementId);
    const r = restock({ supplement, ...parsed.data });
    if (!r.ok) return r;
    return applyStock(tx, userId, r);
  });
}

export async function adjustStockDb(
  db: Db,
  userId: string,
  supplementId: string,
  input: unknown,
): Promise<Result<StockResult>> {
  const parsed = adjustInputSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  return withUser(db, userId, async (tx) => {
    const supplement = await lockSupplement(tx, userId, supplementId);
    const r = adjustStock({ supplement, ...parsed.data });
    if (!r.ok) return r;
    return applyStock(tx, userId, r);
  });
}

async function applyStock(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  userId: string,
  r: Extract<Result<StockResult>, { ok: true }>,
): Promise<Result<StockResult>> {
  const [txRow] = await tx
    .insert(inventoryTransactions)
    .values({ ...r.value.transaction, userId })
    .returning();
  const [row] = await tx
    .update(supplements)
    .set({ stockQuantity: r.value.supplement.stockQuantity, expirationDate: r.value.supplement.expirationDate ?? null })
    .where(and(eq(supplements.id, r.value.supplement.id), eq(supplements.userId, userId)))
    .returning();
  return {
    ok: true,
    value: { supplement: { ...r.value.supplement, updatedAt: iso(row.updatedAt) }, transaction: toTransaction(txRow) },
  };
}
