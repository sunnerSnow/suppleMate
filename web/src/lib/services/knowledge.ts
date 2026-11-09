import { inArray } from "drizzle-orm";
import { getAiProvider } from "@/lib/ai/client";
import { generateValidated } from "@/lib/ai/structured";
import { aiEnv } from "@/lib/config";
import type { Db } from "@/lib/db/local";
import { knowledge } from "@/lib/db/schema";
import { withService, withUser } from "@/lib/db/with-user";
import { AppError, validationFailed } from "@/lib/errors";
import { findBuiltin } from "@/lib/knowledge/match";
import { normalizeName } from "@/lib/knowledge/normalize";
import {
  KNOWLEDGE_PROMPT_VERSION,
  KNOWLEDGE_SYSTEM_PROMPT,
  knowledgeRetryPrompt,
  knowledgeUserPrompt,
} from "@/lib/knowledge/prompt";
import {
  type KnowledgeContent,
  type KnowledgeEntry,
  knowledgeEntrySchema,
  knowledgeJsonSchema,
} from "@/lib/knowledge/types";
import { consumeRateLimit } from "@/lib/services/rate-limit";

/**
 * 保健品小知識：先查內建資料，再查 sm.knowledge 的共用快取（AI 產生過的），都沒有就回 null。
 * 產生（generate）要使用者明確按下，且受每人每小時、全站每日的次數限制。
 *
 * 快取只用「使用者輸入」正規化後的 slug 當鍵，不用 AI 回傳的別名比對：
 * 別名是模型輸出，若拿來當查詢鍵，任何人產生的卡片都能冒充其他名稱，污染所有使用者看到的內容。
 */

const NAME_MAX = 60;
const MANY_MAX = 50;
// 控制字元（含換行）：避免把多行指令塞進提示詞
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function cleanName(input: unknown): string {
  const name = typeof input === "string" ? input.trim() : "";
  if (!name) throw validationFailed([{ field: "name", message: "請輸入保健品名稱" }]);
  if (name.length > NAME_MAX) throw validationFailed([{ field: "name", message: `名稱最多 ${NAME_MAX} 個字` }]);
  if (CONTROL_CHARS.test(name)) throw validationFailed([{ field: "name", message: "名稱不可包含換行或控制字元" }]);
  if (/[<>]/.test(name)) throw validationFailed([{ field: "name", message: "名稱不可包含 < 或 >" }]);
  // 正規化後為空（例如只有劑量「500mg」或標點）就不查、不產生，避免白耗 AI 額度與寫入空鍵
  if (!normalizeName(name))
    throw validationFailed([{ field: "name", message: "請輸入保健品的名稱，不要只有劑量或符號" }]);
  return name;
}

function rowToEntry(row: typeof knowledge.$inferSelect): KnowledgeEntry | null {
  const parsed = knowledgeEntrySchema.safeParse(row.entry);
  // 快取裡的資料是 zod 驗證過才寫入的；萬一格式升級不相容就當作沒有
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    slug: row.slug,
    source: row.source,
    model: row.model ?? undefined,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** 正式 provider 是 Gemini 時，mock 產生的示範卡視為未命中，之後會被真正的內容取代 */
function usable(entry: KnowledgeEntry | null): KnowledgeEntry | null {
  if (entry && entry.source === "mock" && aiEnv().provider === "gemini") return null;
  return entry;
}

/** 批次查快取（以使用者身分，RLS 允許讀全部）：slug → entry */
async function findCachedMany(db: Db, userId: string, slugs: string[]): Promise<Map<string, KnowledgeEntry>> {
  const out = new Map<string, KnowledgeEntry>();
  const wanted = [...new Set(slugs.filter(Boolean))];
  if (wanted.length === 0) return out;
  const rows = await withUser(db, userId, (tx) => tx.select().from(knowledge).where(inArray(knowledge.slug, wanted)));
  for (const row of rows) {
    const entry = usable(rowToEntry(row));
    if (entry) out.set(row.slug, entry);
  }
  return out;
}

async function findCached(db: Db, userId: string, name: string): Promise<KnowledgeEntry | null> {
  const slug = normalizeName(name);
  if (!slug) return null;
  return (await findCachedMany(db, userId, [slug])).get(slug) ?? null;
}

export async function lookupKnowledge(db: Db, userId: string, input: unknown): Promise<KnowledgeEntry | null> {
  const name = cleanName(input);
  return findBuiltin(name) ?? (await findCached(db, userId, name));
}

/** 一次查多個名稱（今日頁、方案頁用），回傳 名稱 → entry（找不到的不會出現）；內建的先在記憶體解決，其餘一次查資料庫 */
export async function lookupMany(db: Db, userId: string, names: string[]): Promise<Record<string, KnowledgeEntry>> {
  const out: Record<string, KnowledgeEntry> = {};
  const pending: { name: string; slug: string }[] = [];
  for (const raw of [...new Set(names)].slice(0, MANY_MAX)) {
    const name = typeof raw === "string" ? raw.trim().slice(0, NAME_MAX) : "";
    if (!name || CONTROL_CHARS.test(name)) continue;
    const builtin = findBuiltin(name);
    if (builtin) out[raw] = builtin;
    else if (normalizeName(name)) pending.push({ name: raw, slug: normalizeName(name) });
  }
  if (pending.length) {
    const cached = await findCachedMany(
      db,
      userId,
      pending.map((p) => p.slug),
    );
    for (const p of pending) {
      const entry = cached.get(p.slug);
      if (entry) out[p.name] = entry;
    }
  }
  return out;
}

/**
 * 請 AI 整理一張小知識卡並存進共用快取。
 * 已有內建或快取就直接回傳，不再呼叫 AI；限流以「嘗試」計次（失敗也算）：
 * 先看個人、再看全站，個人被擋時不扣全站額度，單一帳號刷不掉大家的額度。
 * 正式環境沒設定真正的 AI provider 時直接拒絕，避免把示範內容寫進共用快取。
 */
export async function generateKnowledge(db: Db, userId: string, input: unknown): Promise<KnowledgeEntry> {
  const name = cleanName(input);
  const existing = findBuiltin(name) ?? (await findCached(db, userId, name));
  if (existing) return existing;

  const env = aiEnv();
  if (env.provider === "mock" && process.env.NODE_ENV === "production") {
    throw new AppError("ai_not_configured", "AI 整理尚未開放，請先用內建資料或稍後再試", 503);
  }
  const userOk = await consumeRateLimit(db, `ai:user:${userId}`, env.hourlyLimit, 3600);
  if (!userOk) throw new AppError("rate_limited", `每小時最多請 AI 整理 ${env.hourlyLimit} 次，請稍後再試`, 429);
  if (env.dailyLimit > 0) {
    const globalOk = await consumeRateLimit(db, "ai:global", env.dailyLimit, 86400);
    if (!globalOk) throw new AppError("rate_limited", "今天全站的 AI 額度已用完，請明天再試", 429);
  }

  const provider = getAiProvider();
  const { data, model } = await generateValidated<KnowledgeContent>(provider, {
    system: KNOWLEDGE_SYSTEM_PROMPT,
    user: knowledgeUserPrompt(name),
    schema: knowledgeEntrySchema,
    jsonSchema: knowledgeJsonSchema(),
    retryPrompt: knowledgeRetryPrompt,
    hint: name,
  });

  const slug = normalizeName(name);
  // 別名只保留與使用者輸入有包含關係的（顯示用），避免模型替卡片「認領」別的名稱；查詢永遠不用別名
  const aliases = [...new Set([normalizeName(data.name), ...data.aliases.map(normalizeName)])].filter(
    (a) => a && a !== slug && (a.includes(slug) || slug.includes(a)),
  );
  const source = provider.name === "gemini" ? "ai" : "mock";
  const [row] = await withService(db, (tx) =>
    tx
      .insert(knowledge)
      .values({
        slug,
        name: data.name,
        aliases,
        entry: data,
        source,
        model,
        promptVersion: KNOWLEDGE_PROMPT_VERSION,
        createdBy: userId,
      })
      .onConflictDoUpdate({
        target: knowledge.slug,
        set: { name: data.name, aliases, entry: data, source, model, promptVersion: KNOWLEDGE_PROMPT_VERSION },
      })
      .returning(),
  );
  const entry = rowToEntry(row);
  if (!entry) throw new AppError("ai_invalid_output", "AI 回傳的內容格式不正確，請稍後再試一次", 502);
  return entry;
}
