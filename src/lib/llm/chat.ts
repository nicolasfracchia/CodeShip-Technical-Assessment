import { streamText } from "ai";
import { estimateCost, getFallbackChain, getModel, type ModelConfig } from "./config";
import { createLanguageModel } from "./providers";
import { allFailedMessage, classifyError, type ClassifiedError } from "./errors";
import { SYSTEM_PROMPT, buildModelMessages, trimHistory } from "../prompt";
import type { ChatMessage, SourcePassage } from "../kb";
import type { StreamEvent } from "../events";

/** Abort an attempt if no token arrives within this time, then move to the next provider. */
const FIRST_TOKEN_TIMEOUT_MS = 20_000;
/** Abort an attempt that stalls mid-answer. */
const IDLE_TIMEOUT_MS = 20_000;
/** Cap on providers tried for one message, so a bad outage can't exceed the function time limit. */
const MAX_ATTEMPTS = 4;

export interface ChatRequest {
  messages: ChatMessage[];
  modelId: string;
  sources: SourcePassage[];
  signal?: AbortSignal;
}

/** Test seam: lets tests replace the real provider call. */
export type StreamFn = (args: {
  model: ModelConfig;
  messages: ChatMessage[];
  signal: AbortSignal;
}) => AsyncIterable<
  | { type: "text"; text: string }
  /** Reasoning/thinking activity: not shown, but proves the provider is alive (resets the idle timer). */
  | { type: "activity" }
  | { type: "usage"; inputTokens: number; outputTokens: number; truncated?: boolean }
>;

export const realStream: StreamFn = async function* ({ model, messages, signal }) {
  const result = streamText({
    model: createLanguageModel(model),
    instructions: SYSTEM_PROMPT,
    messages,
    temperature: 0,
    maxOutputTokens: model.maxOutputTokens,
    maxRetries: 0, // our own fallback chain handles failures
    abortSignal: signal,
    ...(model.providerOptions ? { providerOptions: model.providerOptions as never } : {}),
  });
  let inputTokens = 0;
  let outputTokens = 0;
  let truncated = false;
  for await (const part of result.stream) {
    switch (part.type) {
      case "text-delta":
        if (part.text) yield { type: "text", text: part.text };
        break;
      case "reasoning-delta":
        yield { type: "activity" };
        break;
      case "finish-step":
      case "finish": {
        if (part.finishReason === "length") truncated = true;
        const u = "totalUsage" in part ? part.totalUsage : part.usage;
        if (u) {
          inputTokens = u.inputTokens ?? inputTokens;
          outputTokens = u.outputTokens ?? outputTokens;
        }
        break;
      }
      case "error":
        // Some OpenAI-compatible providers (e.g. Cloudflare) send one non-standard chunk that fails
        // schema validation while the rest of the stream is fine; skip it. Anything else is fatal.
        if ((part.error as Error)?.name === "AI_TypeValidationError") break;
        throw part.error;
      case "abort":
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }
  }
  yield { type: "usage", inputTokens, outputTokens, truncated };
};

/**
 * Streams one answer, falling back across providers.
 * E8: if a provider fails after it has started streaming, a "reset" event tells
 * the client to discard the partial text before the backup model starts, so the
 * user never sees output from two models mixed together.
 */
export async function* runChat(req: ChatRequest, streamFn: StreamFn = realStream): AsyncGenerator<StreamEvent> {
  const requested = getModel(req.modelId);
  const chain = getFallbackChain(req.modelId).slice(0, MAX_ATTEMPTS);
  const failures: (ClassifiedError & { modelId: string; modelName: string })[] = [];

  yield { type: "sources", sources: req.sources };

  for (const model of chain) {
    if (req.signal?.aborted) return;
    yield { type: "start", modelId: model.id, modelName: model.name, fallback: model.id !== req.modelId };

    const controller = new AbortController();
    const onClientAbort = () => controller.abort();
    req.signal?.addEventListener("abort", onClientAbort);
    let timer: ReturnType<typeof setTimeout> | undefined;

    let emitted = "";
    try {
      // Leave room for the answer; trims history for small windows (e.g. 24K Cloudflare).
      const budget = Math.floor(model.contextWindow * 0.9) - model.maxOutputTokens;
      const history = trimHistory(req.messages, Math.max(budget - 3000, 1000));
      const messages = buildModelMessages(history, req.sources);

      let usage = { inputTokens: 0, outputTokens: 0 };
      let truncated = false;
      const iterator = streamFn({ model, messages, signal: controller.signal })[Symbol.asyncIterator]();
      let waitMs = FIRST_TOKEN_TIMEOUT_MS;
      for (;;) {
        // Race each step against a timer so a hung provider can never stall the fallback chain,
        // regardless of whether the SDK honours the abort signal promptly.
        const step = await Promise.race([
          iterator.next(),
          new Promise<"timeout">((resolve) => {
            timer = setTimeout(() => resolve("timeout"), waitMs);
          }),
        ]);
        clearTimeout(timer);
        if (step === "timeout") {
          controller.abort();
          void iterator.return?.();
          throw Object.assign(new Error("timeout"), { name: "AbortError" });
        }
        if (step.done) break;
        const ev = step.value;
        if (ev.type === "text") {
          waitMs = IDLE_TIMEOUT_MS;
          emitted += ev.text;
          yield { type: "delta", text: ev.text };
        } else if (ev.type === "activity") {
          waitMs = IDLE_TIMEOUT_MS;
        } else {
          usage = { inputTokens: ev.inputTokens, outputTokens: ev.outputTokens };
          truncated = !!ev.truncated;
        }
      }
      if (!emitted.trim()) throw Object.assign(new Error("Empty response from provider"), { statusCode: 502 });

      yield {
        type: "done",
        requestedModelId: req.modelId,
        requestedModelName: requested?.name ?? req.modelId,
        modelId: model.id,
        modelName: model.name,
        usage,
        cost: estimateCost(model, usage.inputTokens, usage.outputTokens),
        contextWindow: model.contextWindow,
        truncated,
        failures: failures.map(({ modelId, modelName, kind, message }) => ({ modelId, modelName, kind, message })),
      };
      return;
    } catch (err) {
      if (req.signal?.aborted) return; // user pressed Stop; not a provider failure
      const c = classifyError(err);
      failures.push({ ...c, modelId: model.id, modelName: model.name });
      console.error(`[chat] ${model.id} failed: ${c.kind} ${c.status ?? ""}`, (err as Error)?.message?.slice(0, 300));
      yield {
        type: "reset",
        failedModelId: model.id,
        failedModelName: model.name,
        reason: c.message,
        kind: c.kind,
        discardedChars: emitted.length,
      };
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener("abort", onClientAbort);
    }
  }

  yield {
    type: "error",
    code: failures.length === 0 ? "no_provider" : failures.every((f) => f.kind === "rate_limit") ? "rate_limit" : "all_failed",
    message: allFailedMessage(failures),
    failures: failures.map(({ modelId, modelName, kind, message }) => ({ modelId, modelName, kind, message })),
  };
}
