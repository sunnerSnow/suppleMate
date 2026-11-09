import { z } from "zod";
import { normalizeName } from "@/lib/knowledge/normalize";
import { providerJsonSchema } from "@/lib/knowledge/types";

/**
 * AI 深度健檢的報告結構（zod 驗證；mock 與 Gemini 共用）。
 * 內容是「一般資訊」：remove／adjust 只能指向使用者清單裡的項目，add 用常用中文名；
 * 系統只顯示，不會自動新增、封存或改時段。
 */
const text = (max: number) => z.string().trim().min(1).max(max);

export const CHECKUP_PRIORITIES = ["high", "medium", "low"] as const;
export type CheckupPriority = (typeof CHECKUP_PRIORITIES)[number];

export const checkupReportSchema = z.object({
  overview: text(300).describe("兩三句話的整體評估：目前的組合大致合理嗎、最值得先處理的一件事"),
  add: z
    .array(
      z.object({
        name: text(40).describe("常用中文名，例如「維生素 D」"),
        reason: text(200),
        priority: z.enum(CHECKUP_PRIORITIES),
      }),
    )
    .max(5)
    .describe("依目標、年齡區間與性別，一般人口常見且目前清單沒有的補充；沒有就空陣列"),
  remove: z
    .array(z.object({ name: text(60).describe("必須是清單裡的名稱，一字不差"), reason: text(200) }))
    .max(5)
    .describe("明確重複或與目標無關、可以考慮不用的項目；沒有就空陣列"),
  adjust: z
    .array(
      z.object({
        name: text(60).describe("必須是清單裡的名稱，一字不差"),
        change: text(120).describe("建議怎麼改，例如改到晚餐後、分成兩次"),
        reason: text(200),
      }),
    )
    .max(6),
  cautions: z.array(text(200)).max(5).describe("搭配、總量或族群相關的注意事項"),
  askProfessional: z.array(text(200)).max(3).describe("建議先與醫師、藥師或營養師確認的事"),
});

export type CheckupReport = z.infer<typeof checkupReportSchema>;

export type CheckupReportEntry = CheckupReport & {
  source: "ai" | "mock";
  model?: string;
  updatedAt: string;
  /** 產生之後，保健品清單或個人資料已經改過 */
  stale: boolean;
};

export function checkupJsonSchema(): Record<string, unknown> {
  return providerJsonSchema(checkupReportSchema);
}

/**
 * remove／adjust 只保留能對到使用者清單的名稱；模型若指到清單外的東西（或自己發明的名稱）就丟掉，
 * 避免畫面上出現「建議停用你根本沒有的保健品」。
 */
export function sanitizeReport(report: CheckupReport, listNames: string[]): CheckupReport {
  const norms = listNames.map(normalizeName).filter(Boolean);
  // 完全相等，或至少兩個字的包含關係（「維生素 C」清單裡不會被單一個「C」對上）
  const inList = (name: string) => {
    const m = normalizeName(name);
    return Boolean(m) && norms.some((n) => n === m || (m.length >= 2 && (n.includes(m) || m.includes(n))));
  };
  return {
    ...report,
    remove: report.remove.filter((r) => inList(r.name)),
    adjust: report.adjust.filter((a) => inList(a.name)),
  };
}
