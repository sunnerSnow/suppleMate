import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/local";
import { inventoryTransactions, supplements } from "@/lib/db/schema";
import { isUuid, withUser, type Tx } from "@/lib/db/with-user";
import { adjustStock, initialTransaction } from "@/lib/domain/ledger";
import { supplementInputSchema, type SupplementInput } from "@/lib/domain/validation";
import { issuesFromZod, notFound, validationFailed } from "@/lib/errors";
import { toSupplement, toTransaction } from "@/lib/services/mappers";
import type { InventoryTransaction, Supplement, SupplementStatus } from "@/lib/types";

function parseInput(input: unknown): SupplementInput {
  const parsed = supplementInputSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  return parsed.data;
}

/** 更新用：選填欄位清空時 zod 給 undefined，Drizzle 的 set 會略過 undefined，所以明確轉成 null 才會真的清掉 */
function toUpdateRow(data: SupplementInput) {
  return {
    ...data,
    brand: data.brand ?? null,
    productForm: data.productForm ?? null,
    servingSize: data.servingSize ?? null,
    expirationDate: data.expirationDate ?? null,
    notes: data.notes ?? null,
  };
}

/** 交易內以 for update 鎖住該使用者的保健品列（勾選／補貨要序列化） */
export async function lockSupplement(tx: Tx, userId: string, id: string): Promise<Supplement> {
  if (!isUuid(id)) throw notFound("保健品");
  const [row] = await tx
    .select()
    .from(supplements)
    .where(and(eq(supplements.id, id), eq(supplements.userId, userId)))
    .for("update");
  if (!row) throw notFound("保健品");
  return toSupplement(row);
}

export async function createSupplement(
  db: Db,
  userId: string,
  input: unknown,
): Promise<{ supplement: Supplement; transaction: InventoryTransaction }> {
  const data = parseInput(input);
  return withUser(db, userId, async (tx) => {
    const [row] = await tx
      .insert(supplements)
      .values({ ...data, userId })
      .returning();
    const supplement = toSupplement(row);
    const initial = initialTransaction(supplement);
    const [txRow] = await tx
      .insert(inventoryTransactions)
      .values({ ...initial, userId })
      .returning();
    return { supplement, transaction: toTransaction(txRow) };
  });
}

/**
 * 編輯保健品。若庫存數字被改動，不直接覆蓋，而是記一筆 adjustment 異動，
 * 讓庫存數量與異動紀錄保持一致。既有服用紀錄（快照）不會被改寫。
 */
export async function updateSupplement(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<{ supplement: Supplement; transaction?: InventoryTransaction }> {
  const data = parseInput(input);
  return withUser(db, userId, async (tx) => {
    const existing = await lockSupplement(tx, userId, id);
    let transaction: InventoryTransaction | undefined;
    if (data.stockQuantity !== existing.stockQuantity) {
      const r = adjustStock({ supplement: existing, newQuantity: data.stockQuantity, reason: "編輯保健品時修正庫存" });
      if (!r.ok) throw validationFailed([{ field: "stockQuantity", message: r.error.message }]);
      const [txRow] = await tx
        .insert(inventoryTransactions)
        .values({ ...r.value.transaction, userId })
        .returning();
      transaction = toTransaction(txRow);
    }
    const [row] = await tx
      .update(supplements)
      .set(toUpdateRow(data))
      .where(and(eq(supplements.id, id), eq(supplements.userId, userId)))
      .returning();
    return { supplement: toSupplement(row), transaction };
  });
}

export async function setSupplementStatus(
  db: Db,
  userId: string,
  id: string,
  status: SupplementStatus,
): Promise<Supplement> {
  if (status !== "active" && status !== "archived")
    throw validationFailed([{ field: "status", message: "狀態不正確" }]);
  return withUser(db, userId, async (tx) => {
    const [row] = await tx
      .update(supplements)
      .set({ status })
      .where(and(eq(supplements.id, id), eq(supplements.userId, userId)))
      .returning();
    if (!row) throw notFound("保健品");
    return toSupplement(row);
  });
}
