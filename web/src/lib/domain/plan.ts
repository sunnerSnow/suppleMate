import { SCHEDULE_SLOTS, type IntakeLog, type PlanItem, type ScheduleSlot, type Supplement } from "../types";

/**
 * 計畫項目鍵：supplementId + planDate + slot + 同時段序號。
 * 同一保健品同一天同一時段若排了兩次，序號區分，避免互相覆蓋。
 */
export function planItemKey(supplementId: string, planDate: string, slot: ScheduleSlot, ordinal: number): string {
  return `${supplementId}|${planDate}|${slot}|${ordinal}`;
}

/**
 * 把某一天的計畫從使用中的保健品展開成待勾選項目，並對上當日有效紀錄。
 * 已封存的保健品不出現。
 */
export function buildPlanItems(supplements: Supplement[], logs: IntakeLog[], planDate: string): PlanItem[] {
  const activeLogs = new Map<string, IntakeLog>();
  for (const log of logs) {
    if (log.planDate === planDate && log.status === "taken") activeLogs.set(log.planItemKey, log);
  }

  const items: PlanItem[] = [];
  for (const s of supplements) {
    if (s.status !== "active") continue;
    const seen = new Map<ScheduleSlot, number>();
    for (const slot of s.scheduleSlots) {
      const ordinal = seen.get(slot) ?? 0;
      seen.set(slot, ordinal + 1);
      const key = planItemKey(s.id, planDate, slot, ordinal);
      items.push({
        key,
        supplementId: s.id,
        supplementName: s.name,
        brand: s.brand,
        dose: s.dosePerIntake,
        unit: s.doseUnit,
        slot,
        notes: s.notes,
        log: activeLogs.get(key),
        stockSufficient: s.stockQuantity >= s.dosePerIntake,
        stockQuantity: s.stockQuantity,
      });
    }
  }
  return items;
}

export type SlotGroup = { slot: ScheduleSlot; items: PlanItem[] };

/** 依時段順序分組，空的時段不顯示 */
export function groupBySlot(items: PlanItem[]): SlotGroup[] {
  return SCHEDULE_SLOTS.map((slot) => ({ slot, items: items.filter((i) => i.slot === slot) })).filter(
    (g) => g.items.length > 0,
  );
}

export function planProgress(items: PlanItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.log).length, total: items.length };
}

/**
 * 顯示用的每日用量摘要，例如「1 顆 × 2 次（早餐後、晚餐後）」。
 * 全部尚未確認時只寫「尚未確認」，不推定時段。
 */
export function dailySummary(s: Supplement, slotLabel: (slot: ScheduleSlot) => string): string {
  const base = `${s.dosePerIntake} ${s.doseUnit} × ${s.dailyFrequency} 次`;
  const confirmed = s.scheduleSlots.filter((slot) => slot !== "unconfirmed");
  if (confirmed.length === 0) return `${base}（時段尚未確認）`;
  const labels = s.scheduleSlots.map(slotLabel).join("、");
  return `${base}（${labels}）`;
}
