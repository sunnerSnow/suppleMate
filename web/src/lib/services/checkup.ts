import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getAiProvider } from "@/lib/ai/client";
import { generateValidated } from "@/lib/ai/structured";
import { aiEnv } from "@/lib/config";
import type { Db } from "@/lib/db/local";
import { checkups, supplements } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { AppError } from "@/lib/errors";
import { type CheckupItem, type CheckupProfile, runCheckupRules } from "@/lib/knowledge/checkup";
import {
  CHECKUP_PROMPT_VERSION,
  CHECKUP_SYSTEM_PROMPT,
  checkupRetryPrompt,
  checkupUserPrompt,
} from "@/lib/knowledge/checkup-prompt";
import {
  type CheckupReport,
  type CheckupReportEntry,
  checkupJsonSchema,
  checkupReportSchema,
  sanitizeReport,
} from "@/lib/knowledge/checkup-report";
import { lookupMany } from "@/lib/services/knowledge";
import { toSupplement } from "@/lib/services/mappers";
import { getProfile } from "@/lib/services/profiles";
import { consumeRateLimit } from "@/lib/services/rate-limit";

/**
 * AI 深度健檢：把使用者目前的保健品、個人資料與內建規則的發現交給 AI，產生整體報告並快取。
 * - 快取以 input_hash 判斷是否仍對應目前的資料；一致就直接回，不扣額度。
 * - 和小知識共用每人每小時、全站每日的 AI 額度（同一組 rate-limit key）。
 * - 正式環境沒設定真正的 AI provider 時拒絕產生，避免把示範內容存成報告。
 */

type CheckupInput = { items: CheckupItem[]; profile: CheckupProfile; hash: string };

async function loadInput(db: Db, userId: string): Promise<CheckupInput> {
  const profile = await getProfile(db, userId);
  if (!profile) throw new AppError("not_found", "找不到使用者", 404);
  const rows = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(supplements)
      .where(and(eq(supplements.userId, userId), eq(supplements.status, "active")))
      .orderBy(supplements.createdAt),
  );
  const list = rows.map(toSupplement);
  const entries = await lookupMany(
    db,
    userId,
    list.map((s) => s.name),
  );
  const items: CheckupItem[] = list.map((s) => ({ supplement: s, entry: entries[s.name] ?? null }));
  const p: CheckupProfile = { healthGoals: profile.healthGoals, ageRange: profile.ageRange, sex: profile.sex };
  return { items, profile: p, hash: inputHash(items, p) };
}

/** 清單（名稱、劑量、次數、時段）＋個人資料＋提示詞版本的雜湊；任何一項變了報告就過期 */
export function inputHash(items: CheckupItem[], profile: CheckupProfile): string {
  const canonical = {
    v: CHECKUP_PROMPT_VERSION,
    items: items
      .map(({ supplement: s }) => [s.name, s.dosePerIntake, s.doseUnit, s.dailyFrequency, [...s.scheduleSlots].sort()])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    goals: [...profile.healthGoals].sort(),
    age: profile.ageRange ?? null,
    sex: profile.sex ?? null,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function rowToEntry(row: typeof checkups.$inferSelect, currentHash: string): CheckupReportEntry | null {
  const parsed = checkupReportSchema.safeParse(row.report);
  if (!parsed.success) return null;
  // 正式 provider 是 Gemini 時，mock 產生的示範報告視為沒有
  if (row.source === "mock" && aiEnv().provider === "gemini") return null;
  return {
    ...parsed.data,
    source: row.source,
    model: row.model ?? undefined,
    updatedAt: new Date(row.updatedAt).toISOString(),
    stale: row.inputHash !== currentHash,
  };
}

async function readRow(db: Db, userId: string) {
  const [row] = await withUser(db, userId, (tx) =>
    tx.select().from(checkups).where(eq(checkups.userId, userId)).limit(1),
  );
  return row ?? null;
}

/** 上一次的報告（可能已過期，由 stale 標示）；沒有就 null */
export async function getCheckup(db: Db, userId: string): Promise<CheckupReportEntry | null> {
  const { hash } = await loadInput(db, userId);
  const row = await readRow(db, userId);
  return row ? rowToEntry(row, hash) : null;
}

export async function runCheckup(db: Db, userId: string): Promise<CheckupReportEntry> {
  const { items, profile, hash } = await loadInput(db, userId);
  if (items.length === 0 && profile.healthGoals.length === 0) {
    throw new AppError("validation_failed", "先新增保健品或勾選保健目標，AI 才有東西可以分析", 400);
  }
  const existing = await readRow(db, userId);
  const cached = existing ? rowToEntry(existing, hash) : null;
  if (cached && !cached.stale) return cached;

  const env = aiEnv();
  if (env.provider === "mock" && process.env.NODE_ENV === "production") {
    throw new AppError("ai_not_configured", "AI 健檢尚未開放，請先看內建規則的結果", 503);
  }
  const userOk = await consumeRateLimit(db, `ai:user:${userId}`, env.hourlyLimit, 3600);
  if (!userOk) throw new AppError("rate_limited", `每小時最多請 AI ${env.hourlyLimit} 次，請稍後再試`, 429);
  if (env.dailyLimit > 0) {
    const globalOk = await consumeRateLimit(db, "ai:global", env.dailyLimit, 86400);
    if (!globalOk) throw new AppError("rate_limited", "今天全站的 AI 額度已用完，請明天再試", 429);
  }

  const provider = getAiProvider();
  const findings = runCheckupRules(items, profile);
  const { data, model } = await generateValidated<CheckupReport>(provider, {
    system: CHECKUP_SYSTEM_PROMPT,
    user: checkupUserPrompt(items, profile, findings),
    schema: checkupReportSchema,
    jsonSchema: checkupJsonSchema(),
    retryPrompt: checkupRetryPrompt,
    hint: "checkup",
  });
  const report = sanitizeReport(
    data,
    items.map((i) => i.supplement.name),
  );
  const source = provider.name === "gemini" ? "ai" : "mock";
  const [row] = await withUser(db, userId, (tx) =>
    tx
      .insert(checkups)
      .values({ userId, inputHash: hash, report, source, model, promptVersion: CHECKUP_PROMPT_VERSION })
      .onConflictDoUpdate({
        target: checkups.userId,
        set: { inputHash: hash, report, source, model, promptVersion: CHECKUP_PROMPT_VERSION },
      })
      .returning(),
  );
  const entry = rowToEntry(row, hash);
  if (!entry) throw new AppError("ai_invalid_output", "AI 回傳的內容格式不正確，請稍後再試一次", 502);
  return entry;
}
