"use client";

import { useEffect, useMemo, useState } from "react";
import { lookupKnowledgeManyAction } from "@/app/actions";
import type { KnowledgeEntry } from "@/lib/knowledge/types";

const SEP = "\u0000";

/** 一次查多個保健品名稱的小知識（今日頁的類別膠囊、方案頁用）；找不到的不在結果裡，查詢失敗視為空 */
export function useKnowledgeMap(names: string[]): { map: Record<string, KnowledgeEntry>; loading: boolean } {
  const key = useMemo(() => [...new Set(names)].sort().join(SEP), [names]);
  const [loaded, setLoaded] = useState<{ key: string; map: Record<string, KnowledgeEntry> }>({ key: "", map: {} });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    lookupKnowledgeManyAction(key.split(SEP))
      .then((r) => (r.ok ? r.value : {}))
      .catch(() => ({}) as Record<string, KnowledgeEntry>)
      .then((map) => {
        if (!cancelled) setLoaded({ key, map });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const current = loaded.key === key;
  return { map: key && current ? loaded.map : {}, loading: Boolean(key) && !current };
}
