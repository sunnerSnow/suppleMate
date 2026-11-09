import { z } from "zod";
import { SCHEDULE_SLOTS } from "@/lib/types";

/**
 * 保健品小知識（內建資料與 AI 產生的共用同一個結構）。
 * 所有內容都是「一般資訊」：依常見產品標示與公開營養知識整理，不是醫療建議；
 * 服用時段只是建議，要使用者按「套用」才會寫進計畫。
 */
export const KNOWLEDGE_CATEGORIES = [
  "vitamin",
  "mineral",
  "fatty_acid",
  "probiotic",
  "herbal",
  "amino_acid",
  "protein",
  "other",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  vitamin: "維生素",
  mineral: "礦物質",
  fatty_acid: "脂肪酸",
  probiotic: "益生菌",
  herbal: "草本／植物萃取",
  amino_acid: "胺基酸",
  protein: "蛋白質",
  other: "其他",
};

export const WITH_FOOD = ["with_meal", "empty_stomach", "either"] as const;
export type WithFood = (typeof WITH_FOOD)[number];

export const WITH_FOOD_LABELS: Record<WithFood, string> = {
  with_meal: "隨餐",
  empty_stomach: "空腹",
  either: "餐前餐後皆可",
};

/** 建議時段只允許已確認的時段（不含 unconfirmed） */
const CONFIRMED_SLOTS = SCHEDULE_SLOTS.filter((s) => s !== "unconfirmed") as [
  (typeof SCHEDULE_SLOTS)[number],
  ...(typeof SCHEDULE_SLOTS)[number][],
];

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const knowledgeEntrySchema = z.object({
  name: shortText(60).describe("保健品常用中文名稱"),
  aliases: z.array(shortText(40)).max(12).describe("別名、英文名、常見寫法"),
  category: z.enum(KNOWLEDGE_CATEGORIES),
  summary: shortText(200).describe("一句話說明它是什麼、一般用途"),
  timing: z.object({
    slots: z.array(z.enum(CONFIRMED_SLOTS)).min(1).max(4).describe("常見服用時段，依優先順序；每日多次時依序取用"),
    withFood: z.enum(WITH_FOOD),
    note: shortText(200).describe("為什麼建議這個時機"),
  }),
  typicalRange: z.string().trim().max(120).nullable().describe("一般成人常見攝取範圍；不確定就 null"),
  tips: z.array(shortText(160)).max(5).describe("小知識"),
  cautions: z.array(shortText(160)).max(5).describe("注意事項，用一般資訊的語氣"),
  separateFrom: z
    .array(z.object({ name: shortText(40), reason: shortText(160) }))
    .max(5)
    .describe("建議分開服用的保健品"),
  pairsWith: z
    .array(z.object({ name: shortText(40), reason: shortText(160) }))
    .max(5)
    .describe("常一起服用的保健品"),
});

export type KnowledgeContent = z.infer<typeof knowledgeEntrySchema>;

export type KnowledgeSource = "builtin" | "ai" | "mock";

export type KnowledgeEntry = KnowledgeContent & {
  /** 正規化後的名稱，當快取鍵 */
  slug: string;
  source: KnowledgeSource;
  model?: string;
  updatedAt: string;
};

/** 給 provider 的 JSON Schema（去掉 $schema；nullable 的 anyOf 改成 type 陣列；去掉 maxItems） */
export function knowledgeJsonSchema(): Record<string, unknown> {
  const out = simplifyNullable(
    dropKey(z.toJSONSchema(knowledgeEntrySchema, { target: "draft-2020-12" }), "maxItems"),
  ) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

function dropKey(node: unknown, key: string): unknown {
  if (Array.isArray(node)) return node.map((n) => dropKey(n, key));
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === key) continue;
    out[k] =
      k === "properties" && v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, dropKey(pv, key)]))
        : dropKey(v, key);
  }
  return out;
}

function simplifyNullable(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplifyNullable);
  if (!node || typeof node !== "object") return node;
  const obj = { ...(node as Record<string, unknown>) };
  const anyOf = obj.anyOf;
  if (Array.isArray(anyOf) && anyOf.length === 2) {
    const nullIdx = anyOf.findIndex((v) => v && typeof v === "object" && (v as { type?: unknown }).type === "null");
    const other = anyOf[nullIdx === 0 ? 1 : 0];
    if (nullIdx >= 0 && other && typeof other === "object" && typeof (other as { type?: unknown }).type === "string") {
      const merged = simplifyNullable(other) as Record<string, unknown>;
      delete obj.anyOf;
      return { ...obj, ...merged, type: [merged.type, "null"] };
    }
  }
  for (const key of Object.keys(obj)) obj[key] = simplifyNullable(obj[key]);
  return obj;
}
