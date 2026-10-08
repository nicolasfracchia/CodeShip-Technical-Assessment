import type { Failure } from "@/lib/events";
import type { SourcePassage } from "@/lib/kb";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/** One chat message as the browser keeps it (the server only ever sees role + content). */
export interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error" | "stopped";
  sources?: SourcePassage[];
  requestedModelName?: string;
  modelId?: string;
  modelName?: string;
  usage?: Usage;
  notices?: string[];
  failures?: Failure[];
}

export interface SessionTotals {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  count: number;
}
