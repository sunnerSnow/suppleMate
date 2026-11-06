import { DEFAULT_TIMEZONE } from "../constants";
import { addDays, todayPlanDate } from "../date";
import { initialTransaction, takeIntake } from "../domain/ledger";
import { newId } from "../id";
import type { IntakeLog, InventoryTransaction, Supplement, UserProfile } from "../types";
import type { Snapshot } from "./repository";

type Seed = Omit<Supplement, "id" | "createdAt" | "updatedAt" | "status"> & { status?: Supplement["status"] };

const SEEDS: Seed[] = [
  {
    name: "魚油",
    brand: "Nordic Naturals",
    productForm: "capsule",
    servingSize: "2 顆",
    dosePerIntake: 1,
    doseUnit: "顆",
    dailyFrequency: 2,
    scheduleSlots: ["after_breakfast", "after_dinner"],
    stockQuantity: 48,
    lowStockThreshold: 14,
    expirationDate: "2027-03-31",
    notes: "隨餐服用，依產品標示",
  },
  {
    name: "維生素 D3",
    brand: "Now Foods",
    productForm: "tablet",
    servingSize: "1 錠",
    dosePerIntake: 1,
    doseUnit: "錠",
    dailyFrequency: 1,
    scheduleSlots: ["after_breakfast"],
    stockQuantity: 9,
    lowStockThreshold: 10,
    expirationDate: "2026-12-31",
  },
  {
    name: "益生菌",
    brand: "威德",
    productForm: "powder",
    servingSize: "1 包",
    dosePerIntake: 1,
    doseUnit: "包",
    dailyFrequency: 1,
    scheduleSlots: ["before_breakfast"],
    stockQuantity: 0,
    lowStockThreshold: 5,
    notes: "空腹時配溫水",
  },
  {
    name: "鎂",
    productForm: "capsule",
    dosePerIntake: 2,
    doseUnit: "顆",
    dailyFrequency: 1,
    scheduleSlots: ["bedtime"],
    stockQuantity: 60,
    lowStockThreshold: 10,
  },
  {
    name: "B 群",
    brand: "DHC",
    productForm: "tablet",
    dosePerIntake: 1,
    doseUnit: "錠",
    dailyFrequency: 1,
    scheduleSlots: ["unconfirmed"],
    stockQuantity: 30,
    lowStockThreshold: 7,
    notes: "還沒確認要早上還是中午吃",
  },
  {
    name: "葉黃素",
    productForm: "capsule",
    dosePerIntake: 1,
    doseUnit: "顆",
    dailyFrequency: 1,
    scheduleSlots: ["after_lunch"],
    stockQuantity: 12,
    lowStockThreshold: 5,
    status: "archived",
    notes: "先暫停",
  },
];

/**
 * 產生範例資料。前兩天的服用紀錄會透過 ledger 函式建立，
 * 所以庫存數量與異動紀錄保證一致。
 */
export function buildSampleSnapshot(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): Snapshot {
  const today = todayPlanDate(timezone, now);
  const createdAt = new Date(now.getTime() - 3 * 86_400_000).toISOString();

  const profile: UserProfile = { timezone, createdAt, updatedAt: createdAt };
  const supplements: Supplement[] = SEEDS.map((seed) => ({
    ...seed,
    id: newId(),
    status: seed.status ?? "active",
    createdAt,
    updatedAt: createdAt,
  }));

  const transactions: InventoryTransaction[] = supplements.map((s) => initialTransaction(s, new Date(createdAt)));
  // 範例的初始庫存要「加回」前兩天會扣掉的量，讓今天的數字和 SEEDS 一樣
  const logs: IntakeLog[] = [];

  const byId = new Map(supplements.map((s) => [s.id, s]));

  const simulateDay = (planDate: string, dayOffset: number, skipNames: string[]) => {
    for (const s of supplements) {
      if (s.status !== "active" || skipNames.includes(s.name)) continue;
      const seen = new Map<string, number>();
      s.scheduleSlots.forEach((slot, idx) => {
        if (slot === "unconfirmed") return;
        const ordinal = seen.get(slot) ?? 0;
        seen.set(slot, ordinal + 1);
        const at = new Date(now.getTime() + dayOffset * 86_400_000);
        at.setUTCHours(idx === 0 ? 0 : 12, 10, 0, 0); // 約為台北 08:10 / 20:10
        const r = takeIntake({
          supplement: byId.get(s.id)!,
          planDate,
          slot,
          ordinal,
          existingLogs: logs,
          allowInsufficientStock: true,
          now: at,
        });
        if (r.ok) {
          byId.set(s.id, r.value.supplement);
          logs.push(r.value.log);
          transactions.push(r.value.transaction);
        }
      });
    }
  };

  simulateDay(addDays(today, -2), -2, []);
  simulateDay(addDays(today, -1), -1, ["鎂"]);

  // 把扣掉的量加回初始異動，讓今天的庫存等於 SEEDS 設定值
  const finalSupplements = supplements.map((s) => {
    const consumed = s.stockQuantity - byId.get(s.id)!.stockQuantity;
    const init = transactions.find((t) => t.supplementId === s.id && t.type === "initial")!;
    init.quantityDelta += consumed;
    return { ...byId.get(s.id)!, stockQuantity: s.stockQuantity };
  });

  return { profile, supplements: finalSupplements, intakeLogs: logs, transactions };
}

export function emptySnapshot(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): Snapshot {
  const iso = now.toISOString();
  return {
    profile: { timezone, createdAt: iso, updatedAt: iso },
    supplements: [],
    intakeLogs: [],
    transactions: [],
  };
}
