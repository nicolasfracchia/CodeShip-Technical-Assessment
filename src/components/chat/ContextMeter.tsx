import type { PublicModel } from "@/lib/llm/config";
import { fmtInt } from "@/lib/ui/format";
import type { Msg } from "@/lib/ui/types";

export interface ContextUsage {
  used: number;
  window: number;
  pct: number;
  level: "ok" | "amber" | "red";
}

/**
 * Context-window estimate for the NEXT request on the currently selected model:
 * the last request's input + its answer (both are re-sent next time).
 * Recomputed whenever the model changes (E7).
 */
export function contextUsage(messages: Msg[], selected: PublicModel | undefined): ContextUsage {
  const last = [...messages].reverse().find((m) => m.usage);
  const used = last?.usage ? last.usage.inputTokens + last.usage.outputTokens : 0;
  const window = selected?.contextWindow ?? 0;
  const pct = window ? (used / window) * 100 : 0;
  return { used, window, pct, level: pct >= 90 ? "red" : pct >= 75 ? "amber" : "ok" };
}

/** R4: context bar, amber at 75% and red at 90%. */
export function ContextMeter({ context }: { context: ContextUsage }) {
  return (
    <div className="mx-auto mt-2 max-w-4xl" aria-live="polite">
      <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200">
        <div
          className={`h-full ${context.level === "red" ? "bg-red-500" : context.level === "amber" ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(100, Math.max(context.pct, context.used ? 0.5 : 0))}%` }}
        />
      </div>
      <div
        className={`mt-1 text-xs ${context.level === "red" ? "font-medium text-red-600" : context.level === "amber" ? "font-medium text-amber-600" : "text-slate-500"}`}
      >
        Context: ≈{fmtInt(context.used)} / {fmtInt(context.window)} tokens ({context.pct.toFixed(1)}%)
        {context.level === "amber" && " · Getting close to this model's limit. Consider starting a new conversation."}
        {context.level === "red" && " · Near this model's limit: older messages will be dropped. Start a new conversation."}
      </div>
    </div>
  );
}
