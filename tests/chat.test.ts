import { describe, expect, it } from "vitest";
import { runChat, type StreamFn } from "@/lib/llm/chat";
import { classifyError } from "@/lib/llm/errors";
import { estimateCost, getFallbackChain, getModel, getPublicModels } from "@/lib/llm/config";
import type { StreamEvent } from "@/lib/events";

// Make every configured provider "available" for these tests.
for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "ZAI_API_KEY", "OPENROUTER_API_KEY", "COHERE_API_KEY"]) {
  process.env[k] = "SENTINEL-KEY-9f3a";
}
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

const apiError = (statusCode: number, message = "boom") => Object.assign(new Error(message), { statusCode });

async function collect(gen: AsyncGenerator<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

/** Fake provider: behaviour per model id. */
function fake(behaviour: Record<string, "ok" | "fail-before" | "fail-mid" | "429" | "hang">): StreamFn {
  return async function* ({ model }) {
    const b = behaviour[model.id] ?? "ok";
    if (b === "429") throw apiError(429, "rate limit");
    if (b === "fail-before") throw apiError(503, "down");
    if (b === "hang") await new Promise(() => {});
    yield { type: "text", text: `Answer from ${model.id} part 1. ` };
    if (b === "fail-mid") throw apiError(500, "stream died");
    yield { type: "text", text: "part 2." };
    yield { type: "usage", inputTokens: 1000, outputTokens: 200 };
  };
}

import config from "../config/models.json";
/** First available model after `id` in the configured fallback order. */
const nextAfter = (id: string) => getFallbackChain(id)[1].id;

const req = (modelId: string) => ({ modelId, messages: [{ role: "user" as const, content: "hi" }], sources: [] });

describe("fallback chain", () => {
  it("uses the selected model when healthy and reports usage + cost", async () => {
    const ev = await collect(runChat(req("cloudflare-llama"), fake({})));
    const done = ev.find((e) => e.type === "done");
    expect(done).toMatchObject({ modelId: "cloudflare-llama", requestedModelId: "cloudflare-llama", usage: { inputTokens: 1000, outputTokens: 200 } });
    expect(ev.some((e) => e.type === "reset")).toBe(false);
  });

  it("falls back when the provider fails before streaming", async () => {
    const ev = await collect(runChat(req("gemini-flash"), fake({ "gemini-flash": "fail-before" })));
    const done = ev.find((e) => e.type === "done") as Extract<StreamEvent, { type: "done" }>;
    expect(done.modelId).toBe(nextAfter("gemini-flash")); // next in fallbackOrder
    expect(done.requestedModelId).toBe("gemini-flash");
    expect(done.failures[0]).toMatchObject({ modelId: "gemini-flash", kind: "unavailable" });
  });

  it("E8: mid-stream failure emits reset before the backup's text (no mixed output)", async () => {
    const ev = await collect(runChat(req("gemini-flash"), fake({ "gemini-flash": "fail-mid" })));
    // Replay the client logic: reset clears the text.
    let text = "";
    for (const e of ev) {
      if (e.type === "delta") text += e.text;
      if (e.type === "reset") text = "";
    }
    expect(text).toBe(`Answer from ${nextAfter("gemini-flash")} part 1. part 2.`);
    expect(text).not.toContain("gemini");
    const resetIdx = ev.findIndex((e) => e.type === "reset");
    const backupStart = ev.findIndex((e) => e.type === "start" && e.modelId === nextAfter("gemini-flash"));
    expect(resetIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeLessThan(backupStart);
    expect(ev.at(-1)).toMatchObject({ type: "done", modelId: nextAfter("gemini-flash") });
  });

  it("E9: everything rate-limited ends with a clear, actionable message", async () => {
    const all429 = Object.fromEntries(config.models.map((m) => [m.id, "429" as const]));
    const ev = await collect(runChat(req("gemini-flash"), fake(all429)));
    const err = ev.at(-1) as Extract<StreamEvent, { type: "error" }>;
    expect(err.type).toBe("error");
    expect(err.code).toBe("rate_limit");
    expect(err.message).toMatch(/rate-limited.*wait/i);
    expect(err.message).not.toMatch(/stack|Error:/);
  });

  it("a hung provider times out and the backup answers", async () => {
    const ev = await collect(runChat(req("gemini-flash"), fake({ "gemini-flash": "hang" })));
    expect(ev.at(-1)).toMatchObject({ type: "done", modelId: nextAfter("gemini-flash") });
  }, 30_000);

  it("skips models without an API key (placeholders) and disabled models", () => {
    const chain = getFallbackChain("claude-sonnet").map((m) => m.id);
    expect(chain).not.toContain("claude-sonnet");
    expect(chain).not.toContain("openai-gpt");
    expect(chain).not.toContain("sambanova-llama");
    expect(chain[0]).toBe("groq-gpt-oss");
  });
});

describe("errors, cost and public config", () => {
  it("classifies provider errors", () => {
    expect(classifyError(apiError(429)).kind).toBe("rate_limit");
    expect(classifyError(apiError(401)).kind).toBe("auth");
    expect(classifyError(apiError(503)).kind).toBe("unavailable");
    expect(classifyError({ lastError: apiError(429) }).kind).toBe("rate_limit"); // wrapped RetryError
  });

  it("computes cost from config prices", () => {
    const m = getModel("gemini-flash")!;
    const c = estimateCost(m, 1_000_000, 1_000_000);
    expect(c.total).toBeCloseTo(m.pricing.inputPerMTok + m.pricing.outputPerMTok);
  });

  it("public model list never exposes key names or values", () => {
    const json = JSON.stringify(getPublicModels());
    expect(json).not.toMatch(/apiKey|API_KEY|API_TOKEN|baseURL/);
    expect(json).not.toContain("SENTINEL-KEY-9f3a");
  });
});
