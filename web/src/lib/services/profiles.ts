import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/local";
import { profiles } from "@/lib/db/schema";
import { users } from "@/lib/db/auth-schema";
import { withService, withUser, type Tx } from "@/lib/db/with-user";
import { issuesFromZod, validationFailed } from "@/lib/errors";
import { iso } from "@/lib/services/mappers";
import type { UserProfile } from "@/lib/types";

/** 第一次登入時建立 profile（以伺服器身分：此時還沒有可用的 RLS 身分）；顯示名稱預設用註冊時的名字 */
export async function ensureProfile(
  db: Db,
  userId: string,
  email: string | null,
  displayName: string | null = null,
): Promise<void> {
  await withService(db, (tx) =>
    tx
      .insert(profiles)
      .values({ id: userId, email, displayName: displayName?.trim().slice(0, 60) || null })
      .onConflictDoNothing({ target: profiles.id }),
  );
}

/** 交易內讀 profile（給 snapshot 用） */
export async function readProfile(tx: Tx, userId: string): Promise<UserProfile | null> {
  const row = await tx.query.profiles.findFirst({ where: eq(profiles.id, userId) });
  return row ? toProfile(row) : null;
}

/**
 * 取得個人設定。profile 平常在註冊時由 Better Auth 的 hook 建立；
 * 若當時失敗（例如資料庫暫時斷線），這裡會補建一列，流程不會永遠卡住。
 */
export async function getProfile(db: Db, userId: string): Promise<UserProfile | null> {
  const read = () => withUser(db, userId, (tx) => readProfile(tx, userId));
  let profile = await read();
  if (!profile) {
    const [user] = await withService(db, (tx) =>
      tx.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
    );
    if (!user) return null;
    await ensureProfile(db, userId, user.email, user.name);
    profile = await read();
  }
  return profile;
}

const profileInput = z.object({
  displayName: z.string().trim().max(60, "顯示名稱最多 60 個字").optional(),
  timezone: z.string().trim().min(1).max(64, "時區太長").refine(isValidTimezone, "不支援的時區").optional(),
});
export type ProfileInput = z.input<typeof profileInput>;

export async function updateProfile(db: Db, userId: string, input: unknown): Promise<UserProfile> {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const { displayName, timezone } = parsed.data;
  const [row] = await withUser(db, userId, (tx) =>
    tx
      .update(profiles)
      .set({
        ...(displayName !== undefined ? { displayName: displayName || null } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
      })
      .where(eq(profiles.id, userId))
      .returning(),
  );
  if (!row) throw new Error("找不到個人設定");
  return toProfile(row);
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function toProfile(row: typeof profiles.$inferSelect): UserProfile {
  return {
    displayName: row.displayName ?? undefined,
    email: row.email ?? undefined,
    timezone: row.timezone,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}
