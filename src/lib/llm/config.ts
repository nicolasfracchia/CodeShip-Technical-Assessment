import rawConfig from "@config/models.json";

export interface ProviderConfig {
  label: string;
  type: "google" | "openai-compatible";
  baseURL?: string;
  apiKeyEnv: string;
}

export interface ModelConfig {
  id: string;
  provider: string;
  model: string;
  name: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  pricing: { inputPerMTok: number; outputPerMTok: number };
  enabled: boolean;
  disabledReason?: string;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface AppModelConfig {
  defaultModel: string;
  fallbackOrder: string[];
  providers: Record<string, ProviderConfig>;
  models: ModelConfig[];
}

export const modelConfig = rawConfig as unknown as AppModelConfig;

export function getModel(id: string): ModelConfig | undefined {
  return modelConfig.models.find((m) => m.id === id);
}

/** Resolves the API key from the server environment. Never sent to the browser. */
export function getApiKey(provider: ProviderConfig): string | undefined {
  const v = process.env[provider.apiKeyEnv]?.trim();
  return v ? v : undefined;
}

/** Expands ${ENV_VAR} placeholders in provider base URLs (e.g. Cloudflare account id). */
export function resolveBaseURL(provider: ProviderConfig): string | undefined {
  if (!provider.baseURL) return undefined;
  let missing = false;
  const url = provider.baseURL.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => {
    const v = process.env[name]?.trim();
    if (!v) missing = true;
    return v ?? "";
  });
  return missing ? undefined : url;
}

export type Availability = { available: true } | { available: false; reason: string };

export function getAvailability(model: ModelConfig): Availability {
  if (!model.enabled) return { available: false, reason: model.disabledReason ?? "Disabled in config" };
  const provider = modelConfig.providers[model.provider];
  if (!provider) return { available: false, reason: `Unknown provider "${model.provider}"` };
  if (!getApiKey(provider)) return { available: false, reason: "No API key configured" };
  if (provider.baseURL && !resolveBaseURL(provider)) return { available: false, reason: "Provider settings incomplete" };
  return { available: true };
}

/** Selected model first, then the configured fallback order; unavailable models are skipped. */
export function getFallbackChain(selectedId: string): ModelConfig[] {
  const ids = [selectedId, ...modelConfig.fallbackOrder.filter((id) => id !== selectedId)];
  return ids
    .map((id) => getModel(id))
    .filter((m): m is ModelConfig => !!m && getAvailability(m).available);
}

export function estimateCost(model: ModelConfig, inputTokens: number, outputTokens: number) {
  const input = (inputTokens / 1_000_000) * model.pricing.inputPerMTok;
  const output = (outputTokens / 1_000_000) * model.pricing.outputPerMTok;
  return { input, output, total: input + output };
}

/** The safe, public view of a model (what /api/models returns). No keys, no env names. */
export interface PublicModel {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  description: string;
  contextWindow: number;
  pricing: { inputPerMTok: number; outputPerMTok: number };
  available: boolean;
  unavailableReason?: string;
}

export function getPublicModels(): { defaultModel: string; fallbackOrder: string[]; models: PublicModel[] } {
  const models = modelConfig.models.map((m) => {
    const a = getAvailability(m);
    return {
      id: m.id,
      name: m.name,
      provider: m.provider,
      providerLabel: modelConfig.providers[m.provider]?.label ?? m.provider,
      description: m.description,
      contextWindow: m.contextWindow,
      pricing: m.pricing,
      available: a.available,
      ...(a.available ? {} : { unavailableReason: a.reason }),
    };
  });
  const firstAvailable = models.find((m) => m.available)?.id ?? modelConfig.defaultModel;
  const def = models.find((m) => m.id === modelConfig.defaultModel)?.available ? modelConfig.defaultModel : firstAvailable;
  return { defaultModel: def, fallbackOrder: modelConfig.fallbackOrder, models };
}
