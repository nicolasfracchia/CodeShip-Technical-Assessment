import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getApiKey, modelConfig, resolveBaseURL, type ModelConfig } from "./config";

/** Builds an AI SDK model from config. Keys are read from server env only. */
export function createLanguageModel(model: ModelConfig): LanguageModel {
  const provider = modelConfig.providers[model.provider];
  if (!provider) throw new Error(`Unknown provider ${model.provider}`);
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error(`Missing API key for ${provider.label}`);

  switch (provider.type) {
    case "google":
      return createGoogle({ apiKey })(model.model);
    case "openai-compatible": {
      const baseURL = resolveBaseURL(provider);
      if (!baseURL) throw new Error(`Missing base URL settings for ${provider.label}`);
      return createOpenAICompatible({
        name: model.provider,
        baseURL,
        apiKey,
        includeUsage: true, // ask for token usage in the final streamed chunk
      })(model.model);
    }
    default:
      throw new Error(`Unsupported provider type ${(provider as { type: string }).type}`);
  }
}
