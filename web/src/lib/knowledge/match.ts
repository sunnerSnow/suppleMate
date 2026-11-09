import { BUILTIN_ALIASES, builtinByAlias } from "@/lib/knowledge/builtin";
import { bestAliasMatch, normalizeName } from "@/lib/knowledge/normalize";
import type { KnowledgeEntry } from "@/lib/knowledge/types";

/** 用產品名稱找內建小知識（只做字串比對，不猜） */
export function findBuiltin(productName: string): KnowledgeEntry | null {
  const alias = bestAliasMatch(productName, BUILTIN_ALIASES);
  return alias ? builtinByAlias(alias) : null;
}

/** 某個「分開／一起」條目提到的名稱是否就是這筆 entry */
export function entryMatchesName(entry: KnowledgeEntry, name: string): boolean {
  const norm = normalizeName(name);
  if (!norm) return false;
  return [entry.name, ...entry.aliases].some((a) => normalizeName(a) === norm);
}
