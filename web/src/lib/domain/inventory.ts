import type { StockStatus, Supplement } from "../types";

/** 每日預計消耗量 = 每次服用量 × 每日次數。未確認的時段也算在內（使用者已輸入每日次數）。 */
export function dailyConsumption(s: Pick<Supplement, "dosePerIntake" | "dailyFrequency">): number {
  return round(s.dosePerIntake * s.dailyFrequency);
}

/**
 * 預估剩餘天數 = 目前庫存 ÷ 每日預計消耗量，向下取整避免高估。
 * 每日消耗量為 0、或所有時段都尚未確認時回傳 null（UI 顯示「尚無法估算」）。
 */
export function estimateDaysLeft(
  s: Pick<Supplement, "dosePerIntake" | "dailyFrequency" | "stockQuantity" | "scheduleSlots">,
): number | null {
  const perDay = dailyConsumption(s);
  if (perDay <= 0) return null;
  if (s.scheduleSlots.length > 0 && s.scheduleSlots.every((slot) => slot === "unconfirmed")) return null;
  if (s.stockQuantity <= 0) return 0;
  return Math.floor(s.stockQuantity / perDay);
}

/** 低庫存狀態以使用者設定的門檻為準 */
export function stockStatus(s: Pick<Supplement, "stockQuantity" | "lowStockThreshold" | "dosePerIntake">): StockStatus {
  if (s.stockQuantity <= 0 || s.stockQuantity < s.dosePerIntake) return "out";
  if (s.stockQuantity <= s.lowStockThreshold) return "low";
  return "sufficient";
}

/** 避免浮點誤差（例如 0.1 + 0.2），數量統一保留 3 位小數 */
export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** 顯示數量：整數不帶小數，小數最多 3 位 */
export function formatQuantity(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round(n));
}
