export type AiProvider = "openrouter" | "gemini" | "tokenrouter" | "openai";
export type ProviderEnvironment = {
  AI_PROVIDER?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TOKENROUTER_API_KEY?: string;
  TOKENROUTER_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_ASSESSMENT_MODEL?: string;
};

export function selectedAi(environment: ProviderEnvironment): {
  provider: AiProvider;
  model: string;
} {
  const preference = (environment.AI_PROVIDER || "auto").trim().toLowerCase();
  if (
    !["auto", "openrouter", "gemini", "tokenrouter", "openai"].includes(
      preference,
    )
  )
    throw new Error(
      "AI_PROVIDER phải là auto, openrouter, gemini, tokenrouter hoặc openai.",
    );
  const provider: AiProvider =
    preference === "auto"
      ? environment.OPENROUTER_API_KEY
        ? "openrouter"
        : environment.GEMINI_API_KEY
          ? "gemini"
          : environment.TOKENROUTER_API_KEY
            ? "tokenrouter"
            : "openai"
      : (preference as AiProvider);
  const models = {
    openrouter: environment.OPENROUTER_MODEL?.trim() || "",
    gemini: environment.GEMINI_MODEL?.trim() || "gemini-flash-latest",
    tokenrouter:
      environment.TOKENROUTER_MODEL?.trim() || "qwen/qwen3.8-max-free",
    openai: environment.OPENAI_ASSESSMENT_MODEL?.trim() || "gpt-5.6-luna",
  };
  if (
    provider === "openrouter" &&
    (!models.openrouter ||
      models.openrouter === "openrouter/auto" ||
      models.openrouter.includes(":nitro"))
  )
    throw new Error(
      "Hãy cấu hình OPENROUTER_MODEL bằng một model cụ thể, hỗ trợ structured outputs.",
    );
  return { provider, model: models[provider] };
}
