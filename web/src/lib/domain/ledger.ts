import { newId } from "../id";
import type { IntakeLog, InventoryTransaction, ScheduleSlot, Supplement } from "../types";
import { round } from "./inventory";
import { planItemKey } from "./plan";

/**
 * 庫存與服用紀錄的純函式。不碰儲存層，輸入目前狀態、輸出新狀態與要寫入的紀錄。
 * 儲存層（localStorage 或 Firestore transaction）負責把結果原子性地寫回。
 */

export type LedgerErrorCode =
  "ALREADY_TAKEN" | "INSUFFICIENT_STOCK" | "ALREADY_REVERSED" | "ARCHIVED" | "INVALID_QUANTITY" | "INVALID_PLAN_ITEM";

export type LedgerError = { code: LedgerErrorCode; message: string };

export type Result<T> = { ok: true; value: T } | { ok: false; error: LedgerError };

const fail = <T>(code: LedgerErrorCode, message: string): Result<T> => ({ ok: false, error: { code, message } });

export type IntakeResult = {
  supplement: Supplement;
  log: IntakeLog;
  transaction: InventoryTransaction;
};

export type TakeIntakeInput = {
  supplement: Supplement;
  planDate: string;
  slot: ScheduleSlot;
  /** 同一時段第幾次（從 0 起），預設 0 */
  ordinal?: number;
  /** 該使用者所有（或至少該日）的服用紀錄，用來檢查是否已勾選 */
  existingLogs: IntakeLog[];
  /** 使用者已明確確認「庫存不足仍要記錄」 */
  allowInsufficientStock?: boolean;
  now?: Date;
};

/**
 * 勾選服用：
 * 1. 同一計畫項目當日已有 taken 紀錄 → ALREADY_TAKEN，不重複扣庫存。
 * 2. 庫存不足且未明確確認 → INSUFFICIENT_STOCK；確認後仍扣除，庫存可能為負，UI 必須標示。
 * 3. 建立紀錄（含名稱／用量／單位快照）、扣庫存、建立 intake 異動。
 */
export function takeIntake(input: TakeIntakeInput): Result<IntakeResult> {
  const { supplement, planDate, slot, ordinal = 0, existingLogs, allowInsufficientStock = false } = input;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  if (supplement.status !== "active") return fail("ARCHIVED", "此保健品已封存，無法記錄服用。");

  const key = planItemKey(supplement.id, planDate, slot, ordinal);
  const duplicate = existingLogs.some((l) => l.planItemKey === key && l.status === "taken");
  if (duplicate) return fail("ALREADY_TAKEN", "這一筆今天已經記錄過了。");

  const dose = supplement.dosePerIntake;
  if (supplement.stockQuantity < dose && !allowInsufficientStock) {
    return fail("INSUFFICIENT_STOCK", "庫存不足，請先補貨或確認仍要記錄。");
  }

  const log: IntakeLog = {
    id: newId(),
    supplementId: supplement.id,
    planDate,
    planSlot: slot,
    planItemKey: key,
    supplementNameSnapshot: supplement.name,
    doseSnapshot: dose,
    unitSnapshot: supplement.doseUnit,
    status: "taken",
    takenAt: nowIso,
    createdAt: nowIso,
  };

  const transaction: InventoryTransaction = {
    id: newId(),
    supplementId: supplement.id,
    type: "intake",
    quantityDelta: -dose,
    relatedIntakeLogId: log.id,
    createdAt: nowIso,
  };

  return {
    ok: true,
    value: {
      supplement: { ...supplement, stockQuantity: round(supplement.stockQuantity - dose), updatedAt: nowIso },
      log,
      transaction,
    },
  };
}

export type ReverseIntakeInput = {
  supplement: Supplement;
  log: IntakeLog;
  now?: Date;
};

/**
 * 取消服用：紀錄必須是 taken，改為 reversed，回補當時扣除的 doseSnapshot，建立 reversal 異動。
 * 已 reversed 的紀錄再撤銷 → ALREADY_REVERSED，防止重複回補。
 */
export function reverseIntake(input: ReverseIntakeInput): Result<IntakeResult> {
  const { supplement, log } = input;
  const nowIso = (input.now ?? new Date()).toISOString();

  if (log.status !== "taken") return fail("ALREADY_REVERSED", "這筆紀錄已經撤銷過了。");
  if (log.supplementId !== supplement.id) return fail("INVALID_QUANTITY", "紀錄與保健品不符。");

  const restored = log.doseSnapshot;
  const reversedLog: IntakeLog = { ...log, status: "reversed", reversedAt: nowIso };
  const transaction: InventoryTransaction = {
    id: newId(),
    supplementId: supplement.id,
    type: "reversal",
    quantityDelta: restored,
    relatedIntakeLogId: log.id,
    createdAt: nowIso,
  };

  return {
    ok: true,
    value: {
      supplement: { ...supplement, stockQuantity: round(supplement.stockQuantity + restored), updatedAt: nowIso },
      log: reversedLog,
      transaction,
    },
  };
}

export type StockResult = { supplement: Supplement; transaction: InventoryTransaction };

export type RestockInput = {
  supplement: Supplement;
  quantity: number;
  purchaseDate?: string;
  expirationDate?: string;
  note?: string;
  now?: Date;
};

/** 補貨：數量必須為正數；可順便更新有效期限；建立 restock 異動。 */
export function restock(input: RestockInput): Result<StockResult> {
  const { supplement, quantity } = input;
  const nowIso = (input.now ?? new Date()).toISOString();
  if (!Number.isFinite(quantity) || quantity <= 0) return fail("INVALID_QUANTITY", "補貨數量必須大於 0。");

  const noteParts = [input.purchaseDate ? `購買日 ${input.purchaseDate}` : null, input.note?.trim() || null].filter(
    Boolean,
  );

  const transaction: InventoryTransaction = {
    id: newId(),
    supplementId: supplement.id,
    type: "restock",
    quantityDelta: round(quantity),
    note: noteParts.length ? noteParts.join("；") : undefined,
    createdAt: nowIso,
  };

  return {
    ok: true,
    value: {
      supplement: {
        ...supplement,
        stockQuantity: round(supplement.stockQuantity + quantity),
        expirationDate: input.expirationDate || supplement.expirationDate,
        updatedAt: nowIso,
      },
      transaction,
    },
  };
}

export type AdjustStockInput = {
  supplement: Supplement;
  newQuantity: number;
  reason: string;
  now?: Date;
};

/** 人工調整：不直接覆蓋，而是記一筆 adjustment 異動並保存原因。 */
export function adjustStock(input: AdjustStockInput): Result<StockResult> {
  const { supplement, newQuantity, reason } = input;
  const nowIso = (input.now ?? new Date()).toISOString();
  if (!Number.isFinite(newQuantity) || newQuantity < 0) return fail("INVALID_QUANTITY", "庫存數量不可小於 0。");

  const delta = round(newQuantity - supplement.stockQuantity);
  const transaction: InventoryTransaction = {
    id: newId(),
    supplementId: supplement.id,
    type: "adjustment",
    quantityDelta: delta,
    note: reason.trim() || "人工調整",
    createdAt: nowIso,
  };

  return {
    ok: true,
    value: {
      supplement: { ...supplement, stockQuantity: round(newQuantity), updatedAt: nowIso },
      transaction,
    },
  };
}

/** 新增保健品時的初始庫存異動 */
export function initialTransaction(supplement: Supplement, now: Date = new Date()): InventoryTransaction {
  return {
    id: newId(),
    supplementId: supplement.id,
    type: "initial",
    quantityDelta: round(supplement.stockQuantity),
    note: "初始庫存",
    createdAt: now.toISOString(),
  };
}

/** 檢查庫存數量與異動紀錄是否一致（測試與除錯用） */
export function ledgerBalance(transactions: InventoryTransaction[], supplementId: string): number {
  return round(
    transactions.filter((t) => t.supplementId === supplementId).reduce((sum, t) => sum + t.quantityDelta, 0),
  );
}
