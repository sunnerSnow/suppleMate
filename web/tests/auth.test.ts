import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth, ensureLocalUsers } from "@/lib/auth/better-auth";
import { LOCAL_USERS } from "@/lib/auth/local-users";
import type { Db } from "@/lib/db/local";
import { withUser } from "@/lib/db/with-user";
import { getProfile } from "@/lib/services/profiles";
import { loadSnapshot } from "@/lib/services/snapshot";
import { createTestDb, rowsOf } from "./helpers/db";

let db: Db;
let auth: ReturnType<typeof createAuth>;

beforeEach(async () => {
  db = await createTestDb();
  auth = createAuth(db);
});

/** 從 Better Auth 的回應取出 session cookie，模擬瀏覽器下一個請求 */
async function signInCookie(email: string, password: string): Promise<string> {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = /(better-auth\.session_token=[^;]+)/.exec(setCookie);
  if (!match) throw new Error(`沒有 session cookie：${setCookie}`);
  return match[1];
}

describe("Better Auth（PGlite）", () => {
  it("註冊後可登入；session 對應到 auth.users 的 uuid，RLS 以它隔離；profile 自動建立", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { email: "yuki@example.test", password: "correct-horse-9", name: "Yuki" },
    });
    expect(signUp.user.id).toMatch(/^[0-9a-f-]{36}$/);

    const cookie = await signInCookie("yuki@example.test", "correct-horse-9");
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.id).toBe(signUp.user.id);

    const profile = await getProfile(db, signUp.user.id);
    expect(profile).toMatchObject({ timezone: "Asia/Taipei", displayName: "Yuki" });
    const uid = rowsOf<{ uid: string }>(
      await withUser(db, signUp.user.id, (tx) => tx.execute(sql`select auth.uid()::text as uid`)),
    );
    expect(uid[0].uid).toBe(signUp.user.id);
    expect((await loadSnapshot(db, signUp.user.id)).supplements).toHaveLength(0);
  });

  it("密碼錯誤或帳號不存在都回 401；重複註冊回 422；密碼太短 400", async () => {
    await auth.api.signUpEmail({ body: { email: "a@example.test", password: "password-123", name: "A" } });
    expect(
      (await auth.api.signInEmail({ body: { email: "a@example.test", password: "wrong-password" }, asResponse: true }))
        .status,
    ).toBe(401);
    expect(
      (
        await auth.api.signInEmail({
          body: { email: "nobody@example.test", password: "password-123" },
          asResponse: true,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await auth.api.signUpEmail({
          body: { email: "A@example.test", password: "password-123", name: "A2" },
          asResponse: true,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await auth.api.signUpEmail({
          body: { email: "b@example.test", password: "short", name: "B" },
          asResponse: true,
        })
      ).status,
    ).toBe(400);
  });

  it("登出後 session 失效", async () => {
    await auth.api.signUpEmail({ body: { email: "c@example.test", password: "password-123", name: "C" } });
    const cookie = await signInCookie("c@example.test", "password-123");
    await auth.api.signOut({ headers: new Headers({ cookie }) });
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  it("示範使用者可重複建立；A 有範例資料、B 沒有", async () => {
    await ensureLocalUsers(auth, db);
    await ensureLocalUsers(auth, db);
    const n = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int n from auth.users`));
    expect(n[0].n).toBe(2);
    const cookie = await signInCookie(LOCAL_USERS[0].email, LOCAL_USERS[0].password);
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.email).toBe(LOCAL_USERS[0].email);
    expect((await loadSnapshot(db, session!.user.id)).supplements.length).toBeGreaterThan(0);
    const cookieB = await signInCookie(LOCAL_USERS[1].email, LOCAL_USERS[1].password);
    const sessionB = await auth.api.getSession({ headers: new Headers({ cookie: cookieB }) });
    expect((await loadSnapshot(db, sessionB!.user.id)).supplements).toHaveLength(0);
  });
});
