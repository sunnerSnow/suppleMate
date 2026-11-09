import { eq } from "drizzle-orm";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { addDays, todayPlanDate } from "@/lib/date";
import type { Db } from "@/lib/db/local";
import { supplements } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import type { z } from "zod";
import type { supplementInputSchema } from "@/lib/domain/validation";
import { takeIntakeDb } from "@/lib/services/ledger";
import { getProfile } from "@/lib/services/profiles";
import { createSupplement } from "@/lib/services/supplements";
import type { Snapshot } from "@/lib/store/repository";
import { loadSnapshot } from "@/lib/services/snapshot";
import type { ScheduleSlot } from "@/lib/types";

type Seed = z.input<typeof supplementInputSchema> & { archived?: boolean };

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
    notes: "先暫停",
    archived: true,
  },
];

/** 前兩天的服用：前天全部、昨天除了「鎂」 */
const SKIP_YESTERDAY = ["鎂"];

/**
 * 為使用者建立範例資料：保健品、前兩天的服用紀錄與庫存異動。
 * 紀錄透過正式的服務層寫入，所以庫存與異動帳保證一致；初始庫存先加上會扣掉的量，讓今天的數字等於 SEEDS。
 */
export async function seedSampleData(db: Db, userId: string): Promise<void> {
  const profile = await getProfile(db, userId);
  const today = todayPlanDate(profile?.timezone ?? DEFAULT_TIMEZONE);
  const days = [
    { date: addDays(today, -2), skip: [] as string[] },
    { date: addDays(today, -1), skip: SKIP_YESTERDAY },
  ];

  for (const seed of SEEDS) {
    const { archived, ...input } = seed;
    const confirmed = input.scheduleSlots.filter((s) => s !== "unconfirmed").length;
    const takesPlanned = archived ? 0 : days.filter((d) => !d.skip.includes(input.name)).length * confirmed;
    const { supplement } = await createSupplement(db, userId, {
      ...input,
      stockQuantity: input.stockQuantity + takesPlanned * input.dosePerIntake,
    });
    if (archived) {
      await withUser(db, userId, (tx) =>
        tx.update(supplements).set({ status: "archived" }).where(eq(supplements.id, supplement.id)),
      );
      continue;
    }
    for (const day of days) {
      if (day.skip.includes(input.name)) continue;
      const seen = new Map<ScheduleSlot, number>();
      for (const slot of input.scheduleSlots) {
        if (slot === "unconfirmed") continue;
        const ordinal = seen.get(slot) ?? 0;
        seen.set(slot, ordinal + 1);
        await takeIntakeDb(db, userId, {
          supplementId: supplement.id,
          planDate: day.date,
          slot,
          ordinal,
          allowInsufficientStock: true,
        });
      }
    }
  }
}

/** 清除使用者全部資料（保健品連帶刪掉紀錄與異動） */
export async function clearUserData(db: Db, userId: string): Promise<Snapshot> {
  await withUser(db, userId, (tx) => tx.delete(supplements).where(eq(supplements.userId, userId)));
  return loadSnapshot(db, userId);
}

export async function resetWithSampleData(db: Db, userId: string): Promise<Snapshot> {
  await withUser(db, userId, (tx) => tx.delete(supplements).where(eq(supplements.userId, userId)));
  await seedSampleData(db, userId);
  return loadSnapshot(db, userId);
}
