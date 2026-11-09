import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "@/lib/auth/better-auth";
import type { Db } from "@/lib/db/local";
import { schema } from "@/lib/db/schema";
import { takeIntakeDb } from "@/lib/services/ledger";
import { getProfile } from "@/lib/services/profiles";
import { loadSnapshot } from "@/lib/services/snapshot";
import { createSupplement } from "@/lib/services/supplements";

/**
 * 對真正的 Postgres（Neon）做一次端到端冒煙測試；只在設定 SMOKE_DATABASE_URL 時執行：
 *   SMOKE_DATABASE_URL=1 npm run test -- tests/neon-smoke.test.ts
 * 會讀 .env.local 的 DATABASE_URL 與 BETTER_AUTH_SECRET，建立一個隨機測試帳號，結束時刪掉。
 * 目的：驗證 Better Auth 註冊後的 hook 在 postgres.js 連線池上能建立 profile（PGlite 單連線測不到）。
 */
const enabled = Boolean(process.env.SMOKE_DATABASE_URL);

describe.skipIf(!enabled)("Neon 冒煙測試", () => {
  let client: ReturnType<typeof postgres>;
  let db: Db;
  let userId: string | null = null;

  beforeAll(() => {
    const envFile = path.join(process.cwd(), ".env.local");
    if (existsSync(envFile)) process.loadEnvFile(envFile);
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("需要 .env.local 的 DATABASE_URL");
    client = postgres(url, { prepare: false, max: 3 });
    db = drizzle(client, { schema }) as unknown as Db;
  });

  afterAll(async () => {
    if (userId) await client`delete from auth.users where id = ${userId}`;
    await client.end();
  });

  it("註冊 → profile 自動建立 → 新增保健品 → 勾選 → 讀回", async () => {
    const auth = createAuth(db);
    const email = `smoke-${randomUUID().slice(0, 8)}@example.test`;
    const signUp = await auth.api.signUpEmail({ body: { email, password: "smoke-test-password-1", name: "Smoke" } });
    userId = signUp.user.id;

    // databaseHooks.user.create.after 應已建立 sm.profiles（外鍵指向 auth.users）
    const direct = await client`select id from sm.profiles where id = ${userId}`;
    expect(direct.length).toBe(1);
    const profile = await getProfile(db, userId);
    expect(profile?.timezone).toBe("Asia/Taipei");

    const { supplement } = await createSupplement(db, userId, {
      name: "冒煙測試魚油",
      dosePerIntake: 1,
      doseUnit: "顆",
      dailyFrequency: 1,
      scheduleSlots: ["after_breakfast"],
      stockQuantity: 3,
      lowStockThreshold: 1,
    });
    const taken = await takeIntakeDb(db, userId, {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "after_breakfast",
      ordinal: 0,
    });
    expect(taken.ok).toBe(true);
    const again = await takeIntakeDb(db, userId, {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "after_breakfast",
      ordinal: 0,
    });
    expect(again.ok).toBe(false);

    const snap = await loadSnapshot(db, userId);
    expect(snap.supplements[0].stockQuantity).toBe(2);
    expect(snap.intakeLogs).toHaveLength(1);
    expect(snap.transactions).toHaveLength(2);

    // RLS：切成 authenticated 但沒有身分時，看不到任何列
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      return tx.execute(sql`select count(*)::int n from sm.supplements`);
    });
    const list = (Array.isArray(rows) ? rows : ((rows as { rows?: { n: number }[] }).rows ?? [])) as { n: number }[];
    expect(list[0].n).toBe(0);
  });
});
