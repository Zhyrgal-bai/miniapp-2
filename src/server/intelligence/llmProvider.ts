/** Optional LLM layer — null provider by default (Tier 1 templates only). */

export type LlmCompleteParams = {
  system: string;
  user: string;
  maxTokens?: number;
};

export interface LlmProvider {
  complete(params: LlmCompleteParams): Promise<string | null>;
}

const nullProvider: LlmProvider = {
  async complete() {
    return null;
  },
};

let cached: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;
  const kind = String(process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  if (kind === "openai" && process.env.OPENAI_API_KEY) {
    // Phase 3: wire OpenAI fetch here; keep stub until product review.
    cached = nullProvider;
    return cached;
  }
  cached = nullProvider;
  return cached;
}
