/**
 * 名稱正規化：全形轉半形、小寫、去掉空白與標點，讓「維生素 D3」「維他命D3」「Vitamin D3」能對上同一筆資料。
 */
const SYNONYMS: [RegExp, string][] = [
  [/維他命/g, "維生素"],
  [/vitamine?/g, "維生素"],
  [/omega[-\s]?3|ω-?3/g, "omega3"],
  [/膠囊|錠劑|錠|軟膠囊|粉末|粉|液體|口服液|顆粒|滴劑/g, ""],
];

export function normalizeName(input: string): string {
  let s = input.normalize("NFKC").toLowerCase().trim();
  for (const [re, to] of SYNONYMS) s = s.replace(re, to);
  // 去掉空白、標點、常見劑量單位
  s = s.replace(/\d+(\.\d+)?\s*(mg|mcg|µg|ug|iu|g|ml|毫克|微克|公克|單位|億)/g, "");
  s = s.replace(/[\s\-_–—·.,，。、()（）\[\]【】/+＋&%％'"「」]/g, "");
  return s;
}

/** 從使用者輸入找出最長的別名命中（別名要先正規化）；單一字元的別名只接受完全相等 */
export function bestAliasMatch(input: string, aliases: string[]): string | null {
  const norm = normalizeName(input);
  if (!norm) return null;
  let best: string | null = null;
  for (const alias of aliases) {
    if (!alias) continue;
    const hit = alias.length === 1 ? norm === alias : norm === alias || norm.includes(alias);
    if (hit && (best === null || alias.length > best.length)) best = alias;
  }
  return best;
}
