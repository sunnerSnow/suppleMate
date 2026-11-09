"use client";

import { useEffect, useState } from "react";
import { generateKnowledgeAction, lookupKnowledgeAction } from "@/app/actions";
import type { KnowledgeEntry } from "@/lib/knowledge/types";

/** 同一次工作階段內查過的名稱不再重查（null 表示查過但沒有） */
const cache = new Map<string, KnowledgeEntry | null>();

export type KnowledgeStatus = "idle" | "loading" | "ready" | "none";

/**
 * 依名稱查小知識（內建或快取）。輸入會防抖；generate() 要使用者按下才呼叫 AI。
 * 狀態由「查過的結果」推導，effect 只負責發請求。
 */
export function useKnowledge(name: string, options: { debounceMs?: number; enabled?: boolean } = {}) {
  const { debounceMs = 350, enabled = true } = options;
  const key = enabled ? name.trim() : "";
  const [results, setResults] = useState<Record<string, KnowledgeEntry | null>>({});
  const [generating, setGenerating] = useState(false);

  const known: KnowledgeEntry | null | undefined = key
    ? key in results
      ? results[key]
      : cache.has(key)
        ? cache.get(key)
        : undefined
    : undefined;

  useEffect(() => {
    if (!key || known !== undefined) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const r = await lookupKnowledgeAction(key).catch(() => null);
      if (cancelled) return;
      // 查詢失敗（斷線、被限流）不當成「沒有資料」，也不寫快取，下次會再查
      if (!r || !r.ok) {
        setResults((prev) => ({ ...prev, [key]: null }));
        return;
      }
      cache.set(key, r.value);
      setResults((prev) => ({ ...prev, [key]: r.value }));
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, known, debounceMs]);

  // React Compiler 會自動記憶；不用 useCallback
  const generate = async (): Promise<{ ok: true; entry: KnowledgeEntry } | { ok: false; message: string }> => {
    if (!key) return { ok: false, message: "請先輸入名稱" };
    setGenerating(true);
    try {
      const r = await generateKnowledgeAction(key).catch(() => null);
      if (!r) return { ok: false, message: "連線失敗，請再試一次" };
      if (!r.ok) return { ok: false, message: r.error.message };
      cache.set(key, r.value);
      setResults((prev) => ({ ...prev, [key]: r.value }));
      return { ok: true, entry: r.value };
    } finally {
      setGenerating(false);
    }
  };

  const status: KnowledgeStatus = !key ? "idle" : known === undefined ? "loading" : known ? "ready" : "none";
  return { status, entry: known ?? null, generating, generate };
}
