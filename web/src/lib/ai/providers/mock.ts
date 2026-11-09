import type { AiProvider, StructuredRequest, StructuredResult } from "@/lib/ai/provider";
import type { CheckupReport } from "@/lib/knowledge/checkup-report";
import type { KnowledgeContent } from "@/lib/knowledge/types";

/**
 * 沒有 API 金鑰時的示範 provider：回傳一份標明「示範內容」的小知識卡。
 * 畫面與資料庫都會記錄 source=mock，不會假裝是真的 AI。
 * 回傳的是 JSON 文字，讓解析與驗證的路徑跟真的 provider 一樣。
 */
export function createMockProvider(options: { delayMs?: number } = {}): AiProvider {
  const delayMs = options.delayMs ?? (process.env.NODE_ENV === "test" ? 0 : 500);
  return {
    name: "mock",
    model: "mock-template",
    async generateStructured(request: StructuredRequest): Promise<StructuredResult> {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const topic = (request.hint ?? "").trim() || "未命名保健品";
      // 依要求的 schema 決定回哪一種示範內容：健檢報告有 overview 欄位，小知識卡沒有
      const props = (request.jsonSchema as { properties?: Record<string, unknown> }).properties ?? {};
      const payload = "overview" in props ? mockCheckup() : mockKnowledge(topic);
      return {
        text: JSON.stringify(payload),
        model: "mock-template",
        inputTokens: null,
        outputTokens: null,
      };
    },
  };
}

export function mockKnowledge(topic: string): KnowledgeContent {
  return {
    name: topic.slice(0, 60),
    aliases: [],
    category: "other",
    summary: `${topic} 的示範小知識卡：目前使用 mock provider，內容是佔位範本，不是 AI 整理的真實內容。`,
    timing: {
      slots: ["after_breakfast"],
      withFood: "either",
      note: "示範內容：設定 AI_PROVIDER=gemini 與 GEMINI_API_KEY 後重新查詢，才會得到依產品整理的服用時機。",
    },
    typicalRange: null,
    tips: ["這是示範內容，用來確認查詢、儲存與套用的流程都能運作。"],
    cautions: ["實際服用方式請依產品標示或專業人員建議。"],
    separateFrom: [],
    pairsWith: [],
  };
}

export function mockCheckup(): CheckupReport {
  return {
    overview:
      "示範報告：目前使用 mock provider，這段文字是佔位範本，不是 AI 依你的清單分析的結果。設定 AI_PROVIDER=gemini 與 GEMINI_API_KEY 後重新分析。",
    add: [],
    remove: [],
    adjust: [],
    cautions: ["這是示範內容，用來確認健檢的流程、快取與畫面都能運作。"],
    askProfessional: ["實際是否需要調整，請與醫師、藥師或營養師討論。"],
  };
}
