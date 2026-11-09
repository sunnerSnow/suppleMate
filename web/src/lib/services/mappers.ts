import type { intakeLogs, inventoryTransactions, supplements } from "@/lib/db/schema";
import type { IntakeLog, InventoryTransaction, Supplement } from "@/lib/types";

/** Postgres 回傳的 timestamptz 字串（例如 2026-11-09 10:00:00+00）統一成 ISO，與領域層建立的格式一致 */
export function iso(value: string): string {
  return new Date(value).toISOString();
}

/** 資料庫列 → 領域型別（去掉 user_id、null 轉 undefined） */
export function toSupplement(row: typeof supplements.$inferSelect): Supplement {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    productForm: row.productForm ?? undefined,
    servingSize: row.servingSize ?? undefined,
    dosePerIntake: row.dosePerIntake,
    doseUnit: row.doseUnit,
    dailyFrequency: row.dailyFrequency,
    scheduleSlots: row.scheduleSlots,
    stockQuantity: row.stockQuantity,
    lowStockThreshold: row.lowStockThreshold,
    expirationDate: row.expirationDate ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toIntakeLog(row: typeof intakeLogs.$inferSelect): IntakeLog {
  return {
    id: row.id,
    supplementId: row.supplementId,
    planDate: row.planDate,
    planSlot: row.planSlot,
    planItemKey: row.planItemKey,
    supplementNameSnapshot: row.supplementNameSnapshot,
    doseSnapshot: row.doseSnapshot,
    unitSnapshot: row.unitSnapshot,
    status: row.status,
    takenAt: row.takenAt ? iso(row.takenAt) : undefined,
    reversedAt: row.reversedAt ? iso(row.reversedAt) : undefined,
    createdAt: iso(row.createdAt),
  };
}

export function toTransaction(row: typeof inventoryTransactions.$inferSelect): InventoryTransaction {
  return {
    id: row.id,
    supplementId: row.supplementId,
    type: row.type,
    quantityDelta: row.quantityDelta,
    relatedIntakeLogId: row.relatedIntakeLogId ?? undefined,
    note: row.note ?? undefined,
    createdAt: iso(row.createdAt),
  };
}
