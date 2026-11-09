import "server-only";
import type { AiProvider } from "@/lib/ai/provider";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { aiEnv } from "@/lib/config";

const cache = globalThis as unknown as { __smAi?: AiProvider };

/** 依環境變數選 provider；只在伺服器端建立，金鑰不會離開伺服器 */
export function getAiProvider(): AiProvider {
  if (cache.__smAi) return cache.__smAi;
  const env = aiEnv();
  cache.__smAi =
    env.provider === "gemini"
      ? createGeminiProvider(env.apiKey!, env.model, { fallbackModel: env.fallbackModel, thinking: env.thinking })
      : createMockProvider();
  return cache.__smAi;
}
