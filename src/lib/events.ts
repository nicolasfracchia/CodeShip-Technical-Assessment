import type { SourcePassage } from "./kb";

/** Wire protocol between /api/chat and the browser: one JSON object per line (NDJSON). */

export interface Failure {
  modelId: string;
  modelName: string;
  kind: string;
  message: string;
}

export type StreamEvent =
  | { type: "sources"; sources: SourcePassage[] }
  | { type: "start"; modelId: string; modelName: string; fallback: boolean }
  | { type: "delta"; text: string }
  /** The current provider failed; discard any partial text from it. */
  | { type: "reset"; failedModelId: string; failedModelName: string; reason: string; kind: string; discardedChars: number }
  | {
      type: "done";
      requestedModelId: string;
      requestedModelName: string;
      /** The model that actually answered (may differ from the requested one after fallback) */
      modelId: string;
      modelName: string;
      usage: { inputTokens: number; outputTokens: number };
      cost: { input: number; output: number; total: number };
      contextWindow: number;
      /** The model hit its output-token limit; the answer is incomplete. */
      truncated: boolean;
      failures: Failure[];
    }
  | { type: "error"; code: string; message: string; failures?: Failure[] };
