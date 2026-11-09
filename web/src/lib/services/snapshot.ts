import { desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/local";
import { intakeLogs, inventoryTransactions, supplements } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { toIntakeLog, toSupplement, toTransaction } from "@/lib/services/mappers";
import { getProfile, readProfile } from "@/lib/services/profiles";
import type { Snapshot } from "@/lib/store/repository";

/** 整份載入使用者資料（MVP 資料量小；之後可改成分頁或只載近期紀錄） */
export async function loadSnapshot(db: Db, userId: string): Promise<Snapshot> {
  // profile 若缺列會補建
  const ensured = await getProfile(db, userId);
  if (!ensured) throw new Error("找不到使用者");
  return withUser(db, userId, async (tx) => {
    const profile = (await readProfile(tx, userId)) ?? ensured;
    const [s, logs, txs] = await Promise.all([
      tx.select().from(supplements).where(eq(supplements.userId, userId)).orderBy(supplements.createdAt),
      tx
        .select()
        .from(intakeLogs)
        .where(eq(intakeLogs.userId, userId))
        .orderBy(desc(intakeLogs.planDate), desc(intakeLogs.createdAt)),
      tx
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.userId, userId))
        .orderBy(desc(inventoryTransactions.createdAt)),
    ]);
    return {
      profile,
      supplements: s.map(toSupplement),
      intakeLogs: logs.map(toIntakeLog),
      transactions: txs.map(toTransaction),
    };
  });
}
