import { HEALTH_GOAL_LABELS, SLOT_LABELS } from "@/lib/constants";
import { pairAdvice, suggestSlots } from "@/lib/knowledge/advice";
import { entryMatchesName, findBuiltin } from "@/lib/knowledge/match";
import type { KnowledgeEntry } from "@/lib/knowledge/types";
import type { HealthGoal, ScheduleSlot, Supplement, UserProfile } from "@/lib/types";

/**
 * 一鍵健檢的內建規則（純函式，沒有副作用、不呼叫 AI）。
 * 依目前使用中的保健品、對應的小知識與個人資料（目標、年齡區間、性別），整理出
 * 「建議調整／可以考慮不用／建議增加／注意」四類發現。
 *
 * 全部是一般資訊，不是醫療建議：規則只比對產品常見用法與一般人口的常見需求，
 * 不做診斷；「可以考慮不用」只在明確重複時才出現；系統不會自動改使用者的資料。
 */

export type CheckupKind = "adjust" | "drop" | "add" | "caution";
export type CheckupSeverity = "high" | "medium" | "low";

export type CheckupFinding = {
  /** 穩定的識別字串（規則＋對象），給 React key 與測試用 */
  id: string;
  kind: CheckupKind;
  severity: CheckupSeverity;
  title: string;
  detail: string;
  /** 相關的保健品 */
  supplementIds: string[];
  /** kind=add 時：常見的選擇（內建小知識裡的名稱），給「新增」用 */
  candidates?: string[];
  /** 可直接套用的時段變更（要使用者按下才會寫入） */
  applySlots?: { supplementId: string; slots: ScheduleSlot[] };
};

export type CheckupItem = { supplement: Supplement; entry: KnowledgeEntry | null };
export type CheckupProfile = Pick<UserProfile, "healthGoals" | "ageRange" | "sex">;

export const KIND_LABELS: Record<CheckupKind, string> = {
  adjust: "建議調整",
  drop: "可以考慮不用",
  add: "建議增加",
  caution: "注意",
};

/** 各保健目標常見的保健品（內建小知識的名稱）；只用來提示「常見選擇」，不是處方 */
export const GOAL_SUPPORT: Record<HealthGoal, string[]> = {
  sleep: ["鎂", "GABA", "色胺酸", "褪黑激素", "芝麻素"],
  immunity: ["維生素 C", "維生素 D", "鋅", "益生菌"],
  joints: ["葡萄糖胺", "薑黃", "膠原蛋白"],
  energy: ["B 群", "輔酶 Q10", "鐵", "瑪卡", "人參"],
  eyes: ["葉黃素", "花青素", "蝦紅素"],
  gut: ["益生菌", "膳食纖維", "酵素"],
  heart: ["魚油", "輔酶 Q10", "納豆激酶", "紅麴"],
  bone: ["鈣", "維生素 D", "維生素 K2", "鎂"],
  skin: ["膠原蛋白", "維生素 C", "維生素 E", "蝦紅素"],
  brain: ["魚油", "B 群", "卵磷脂"],
  stress: ["鎂", "B 群", "GABA"],
  vegetarian: ["維生素 B12", "鐵", "維生素 D", "鋅"],
};

const MEAL_SLOTS: ScheduleSlot[] = ["after_breakfast", "after_lunch", "after_dinner"];
const SEVERITY_RANK: Record<CheckupSeverity, number> = { high: 0, medium: 1, low: 2 };
const CROWDED_SLOT = 5;

const names = (items: CheckupItem[]) => items.map((i) => i.supplement.name).join("、");
const slotNames = (slots: ScheduleSlot[]) => slots.map((s) => SLOT_LABELS[s]).join("、");

/** 目前清單裡有沒有某個（內建名稱的）保健品 */
function has(items: CheckupItem[], name: string): CheckupItem | undefined {
  return items.find((i) => i.entry && entryMatchesName(i.entry, name));
}

export function runCheckupRules(allItems: CheckupItem[], profile: CheckupProfile): CheckupFinding[] {
  const items = allItems.filter((i) => i.supplement.status === "active");
  const out: CheckupFinding[] = [];

  // 1. 同一種成分有兩項以上 → 可以考慮不用
  const bySlug = new Map<string, CheckupItem[]>();
  for (const i of items) if (i.entry) bySlug.set(i.entry.slug, [...(bySlug.get(i.entry.slug) ?? []), i]);
  for (const [slug, group] of bySlug) {
    if (group.length < 2) continue;
    out.push({
      id: `dup:${slug}`,
      kind: "drop",
      severity: "medium",
      title: `${names(group)} 看起來是同一種成分`,
      detail: `都對應到「${group[0].entry!.name}」。通常留一項就夠，兩項都吃要留意總量是否超過產品標示；若是刻意分開的不同劑型可以忽略。`,
      supplementIds: group.map((i) => i.supplement.id),
    });
  }

  // 2. 綜合維他命 ＋ 單方維生素／礦物質 → 注意總量
  const multi = has(items, "綜合維他命");
  if (multi) {
    const overlap = items.filter(
      (i) => i !== multi && i.entry && (i.entry.category === "vitamin" || i.entry.category === "mineral"),
    );
    if (overlap.length) {
      out.push({
        id: "multi-overlap",
        kind: "caution",
        severity: "low",
        title: `${multi.supplement.name} 可能已含 ${names(overlap)} 的成分`,
        detail: "綜合維他命通常已含多種維生素與礦物質，再加單方時請對照標示，留意同一種成分的總量。",
        supplementIds: [multi.supplement.id, ...overlap.map((i) => i.supplement.id)],
      });
    }
  }

  // 3. 小知識說要分開、但目前排在同一時段 → 建議調整
  for (const a of pairAdvice(items)) {
    if (a.kind !== "separate" || !a.sameSlot) continue;
    out.push({
      id: `sep:${[a.a.supplementId, a.b.supplementId].sort().join("|")}`,
      kind: "adjust",
      severity: "high",
      title: `${a.a.name} 與 ${a.b.name} 目前排在同一時段`,
      detail: `${a.reason} 建議把其中一項移到不同時段（相隔 2 小時以上較常見）。`,
      supplementIds: [a.a.supplementId, a.b.supplementId],
    });
  }

  for (const { supplement: s, entry } of items) {
    const confirmed = s.scheduleSlots.filter((x) => x !== "unconfirmed");
    // 4. 時段尚未確認 → 建議調整（有小知識就能一鍵套用）
    if (s.scheduleSlots.includes("unconfirmed")) {
      out.push({
        id: `unconfirmed:${s.id}`,
        kind: "adjust",
        severity: "medium",
        title: `${s.name} 還有時段尚未確認`,
        detail: entry
          ? `常見做法是${slotNames(suggestSlots(entry, s.dailyFrequency))}：${entry.timing.note}`
          : "今日頁不會提醒尚未確認的那一次。到保健品頁設定時段，或輸入更完整的名稱讓系統找到小知識。",
        supplementIds: [s.id],
        applySlots: entry ? { supplementId: s.id, slots: suggestSlots(entry, s.dailyFrequency) } : undefined,
      });
      continue;
    }
    if (!entry || confirmed.length === 0) continue;
    // 5. 隨餐／空腹與目前時段不合 → 建議調整。小知識自己建議的時段一律視為相符（例如酵素餐前），
    //    所以「套用」之後不會再被同一條規則提醒。
    const fits = (x: ScheduleSlot) => entry.timing.slots.includes(x as (typeof entry.timing.slots)[number]);
    const allEmpty = confirmed.every((x) => !MEAL_SLOTS.includes(x) && !fits(x));
    const allMeal = confirmed.every((x) => MEAL_SLOTS.includes(x) && !fits(x));
    if (entry.timing.withFood === "with_meal" && allEmpty) {
      out.push({
        id: `food:${s.id}`,
        kind: "adjust",
        severity: "low",
        title: `${s.name} 建議隨餐，目前排在${slotNames(confirmed)}`,
        detail: entry.timing.note,
        supplementIds: [s.id],
        applySlots: { supplementId: s.id, slots: suggestSlots(entry, s.dailyFrequency) },
      });
    } else if (entry.timing.withFood === "empty_stomach" && allMeal) {
      out.push({
        id: `food:${s.id}`,
        kind: "adjust",
        severity: "low",
        title: `${s.name} 建議空腹，目前排在${slotNames(confirmed)}`,
        detail: entry.timing.note,
        supplementIds: [s.id],
        applySlots: { supplementId: s.id, slots: suggestSlots(entry, s.dailyFrequency) },
      });
    }
  }

  // 6. 同一時段太多項 → 建議分散
  const perSlot = new Map<ScheduleSlot, Set<string>>();
  for (const { supplement: s } of items)
    for (const slot of s.scheduleSlots)
      if (slot !== "unconfirmed") perSlot.set(slot, new Set([...(perSlot.get(slot) ?? []), s.id]));
  for (const [slot, ids] of perSlot) {
    if (ids.size < CROWDED_SLOT) continue;
    out.push({
      id: `crowded:${slot}`,
      kind: "adjust",
      severity: "low",
      title: `${SLOT_LABELS[slot]}有 ${ids.size} 項`,
      detail: "一次吃很多項容易漏掉或腸胃不適，可以把隨餐皆可的項目分到其他餐。",
      supplementIds: [...ids],
    });
  }

  // 「建議增加」會由目標、年齡與搭配三條規則產生；已經出現過的名稱不再由搭配規則重複提
  const suggested = new Set<string>();
  const pushAdd = (f: CheckupFinding) => {
    for (const c of f.candidates ?? []) suggested.add(c);
    out.push(f);
  };
  // 品名沒對到小知識的項目：規則看不出它是什麼，相關的建議要留餘地
  const unknown = items.filter((i) => !i.entry).map((i) => i.supplement.name);
  const unknownNote = unknown.length ? `（${unknown.join("、")} 沒對到小知識，若已是相關產品可以忽略）` : "";

  // 7. 勾選的保健目標還沒有對應的保健品 → 建議增加
  for (const goal of profile.healthGoals) {
    const candidates = GOAL_SUPPORT[goal] ?? [];
    if (goal === "vegetarian") {
      if (has(items, "維生素 B12")) continue;
      pushAdd({
        id: "goal:vegetarian",
        kind: "add",
        severity: unknown.length ? "low" : "medium",
        title: "素食者常見補充維生素 B12",
        detail: `B12 主要來自動物性食物，長期素食常見補充；鐵、維生素 D、鋅也較容易攝取不足。${unknownNote}`,
        supplementIds: [],
        candidates,
      });
      continue;
    }
    if (candidates.some((c) => has(items, c))) continue;
    pushAdd({
      id: `goal:${goal}`,
      kind: "add",
      severity: unknown.length ? "low" : "medium",
      title: `「${HEALTH_GOAL_LABELS[goal]}」還沒看到相關的保健品`,
      detail: `常見選擇：${candidates.join("、")}。要不要補充、補哪一種，請依自己的飲食與專業人員建議。${unknownNote}`,
      supplementIds: [],
      candidates,
    });
  }

  // 8. 年齡區間與性別：一般人口的常見提醒
  const iron = has(items, "鐵");
  if (iron && (profile.sex === "male" || profile.ageRange === "65_plus")) {
    out.push({
      id: "iron-check",
      kind: "caution",
      severity: "medium",
      title: `${iron.supplement.name}：請確認是否需要長期補充`,
      detail: "成年男性與年長者一般較少缺鐵，長期補鐵可能累積；通常建議先抽血確認再決定，請與醫師或藥師討論。",
      supplementIds: [iron.supplement.id],
    });
  }
  if (profile.ageRange === "65_plus") {
    const missing = ["維生素 D", "鈣", "維生素 B12"].filter((n) => !has(items, n));
    if (missing.length) {
      pushAdd({
        id: "age:65",
        kind: "add",
        severity: "low",
        title: `65 歲以上常見補充：${missing.join("、")}`,
        detail: "年長者日曬與吸收能力常較低，這幾項是常見的補充項目；是否需要請依健檢結果與專業人員建議。",
        supplementIds: [],
        candidates: missing,
      });
    }
  } else if (profile.ageRange === "45_64" && profile.sex === "female") {
    const missing = ["鈣", "維生素 D"].filter((n) => !has(items, n));
    if (missing.length === 2) {
      pushAdd({
        id: "age:45f",
        kind: "add",
        severity: "low",
        title: "45 歲以上女性常見補充：鈣、維生素 D",
        detail: "骨質流失在這個階段較快，鈣與維生素 D 是常見的保養組合；飲食中乳製品足夠的人不一定需要。",
        supplementIds: [],
        candidates: missing,
      });
    }
  }
  if (profile.ageRange === "under_18") {
    out.push({
      id: "age:minor",
      kind: "caution",
      severity: "high",
      title: "未成年的需求與劑量和成人不同",
      detail: "內建資料與 AI 整理的攝取範圍都以成人產品為準；未成年請以醫師、藥師或營養師的建議為主。",
      supplementIds: [],
    });
  }

  // 9. 常見搭配還沒有 → 建議增加（低優先，只是提醒；前面已經建議過的名稱不重複）
  const companion = new Map<string, { reason: string; from: CheckupItem }>();
  for (const i of items) {
    if (!i.entry) continue;
    for (const rel of i.entry.pairsWith) {
      if (has(items, rel.name) || suggested.has(rel.name) || !findBuiltin(rel.name) || companion.has(rel.name))
        continue;
      companion.set(rel.name, { reason: rel.reason, from: i });
    }
  }
  for (const [name, { reason, from }] of [...companion].slice(0, 4)) {
    pushAdd({
      id: `pair:${name}`,
      kind: "add",
      severity: "low",
      title: `${from.supplement.name} 常與 ${name} 搭配`,
      detail: reason,
      supplementIds: [from.supplement.id],
      candidates: [name],
    });
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export function checkupSummary(findings: CheckupFinding[]): Record<CheckupKind, number> {
  const out: Record<CheckupKind, number> = { adjust: 0, drop: 0, add: 0, caution: 0 };
  for (const f of findings) out[f.kind] += 1;
  return out;
}
