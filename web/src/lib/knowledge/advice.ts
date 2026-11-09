import { entryMatchesName } from "@/lib/knowledge/match";
import type { KnowledgeEntry } from "@/lib/knowledge/types";
import type { ScheduleSlot, Supplement } from "@/lib/types";

/**
 * 方案建議（純函式）：依使用者目前的保健品與對應的小知識，整理出
 * - 每一項的建議時段（供「套用」）
 * - 需要分開／可以一起的組合
 * 全部是一般資訊，不是醫療建議；系統不會自動改使用者的計畫。
 */

export type SuggestedSchedule = {
  supplementId: string;
  /** 依 dailyFrequency 從建議時段依序取用 */
  slots: ScheduleSlot[];
  withFoodNote: string;
  /** 目前計畫是否已與建議相同 */
  alreadyApplied: boolean;
  /** 目前計畫是否全部尚未確認 */
  unconfirmed: boolean;
};

/** 依每日次數從建議時段清單取用（不足時重複最後一個不合理，改成循環取不同時段） */
export function suggestSlots(entry: KnowledgeEntry, dailyFrequency: number): ScheduleSlot[] {
  const pool = entry.timing.slots;
  const out: ScheduleSlot[] = [];
  for (let i = 0; i < dailyFrequency; i++) out.push(pool[i % pool.length]);
  return out;
}

export function suggestedScheduleFor(s: Supplement, entry: KnowledgeEntry): SuggestedSchedule {
  const slots = suggestSlots(entry, s.dailyFrequency);
  const current = [...s.scheduleSlots].sort().join(",");
  return {
    supplementId: s.id,
    slots,
    withFoodNote: entry.timing.note,
    alreadyApplied: current === [...slots].sort().join(","),
    unconfirmed: s.scheduleSlots.every((x) => x === "unconfirmed"),
  };
}

export type PairAdvice = {
  kind: "separate" | "together";
  a: { supplementId: string; name: string };
  b: { supplementId: string; name: string };
  reason: string;
  /** separate 時：兩者目前有沒有排在同一個時段 */
  sameSlot: boolean;
};

/**
 * 找出目前使用中的保健品之間，小知識有提到要分開或常一起的組合。
 * 以 entry 的 separateFrom／pairsWith 名稱對照其他保健品的 entry。
 */
export function pairAdvice(items: { supplement: Supplement; entry: KnowledgeEntry | null }[]): PairAdvice[] {
  const out: PairAdvice[] = [];
  const seen = new Set<string>();
  const active = items.filter((i) => i.supplement.status === "active" && i.entry);

  for (const x of active) {
    for (const y of active) {
      if (x === y || x.supplement.id === y.supplement.id) continue;
      const key = [x.supplement.id, y.supplement.id].sort().join("|");
      const sameSlot = x.supplement.scheduleSlots.some(
        (s) => s !== "unconfirmed" && y.supplement.scheduleSlots.includes(s),
      );
      for (const rel of x.entry!.separateFrom) {
        if (entryMatchesName(y.entry!, rel.name) && !seen.has(`sep|${key}`)) {
          seen.add(`sep|${key}`);
          out.push({
            kind: "separate",
            a: { supplementId: x.supplement.id, name: x.supplement.name },
            b: { supplementId: y.supplement.id, name: y.supplement.name },
            reason: rel.reason,
            sameSlot,
          });
        }
      }
      for (const rel of x.entry!.pairsWith) {
        if (entryMatchesName(y.entry!, rel.name) && !seen.has(`tog|${key}`)) {
          seen.add(`tog|${key}`);
          out.push({
            kind: "together",
            a: { supplementId: x.supplement.id, name: x.supplement.name },
            b: { supplementId: y.supplement.id, name: y.supplement.name },
            reason: rel.reason,
            sameSlot,
          });
        }
      }
    }
  }
  // 需要分開且目前同時段的排最前面
  return out.sort((p, q) => Number(q.kind === "separate" && q.sameSlot) - Number(p.kind === "separate" && p.sameSlot));
}
