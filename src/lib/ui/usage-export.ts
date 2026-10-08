import type { Msg, SessionTotals } from "./types";

/** R4: downloads the session's per-message usage as CSV or JSON. */
export function exportUsage(messages: Msg[], totals: SessionTotals, format: "csv" | "json") {
  const rows = messages
    .map((m, i) => ({ m, q: messages[i - 1] }))
    .filter(({ m }) => m.role === "assistant" && m.usage)
    .map(({ m, q }, i) => ({
      turn: i + 1,
      question: q?.content ?? "",
      requestedModel: m.requestedModelName ?? "",
      answeredBy: m.modelName ?? "",
      inputTokens: m.usage!.inputTokens,
      outputTokens: m.usage!.outputTokens,
      estimatedCostUSD: Number(m.usage!.cost.toFixed(8)),
    }));
  let blob: Blob;
  if (format === "json") {
    blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), totals, turns: rows }, null, 2)], {
      type: "application/json",
    });
  } else {
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const header = Object.keys(rows[0] ?? { turn: 0 }).join(",");
    blob = new Blob([[header, ...rows.map((r) => Object.values(r).map(esc).join(","))].join("\n")], { type: "text/csv" });
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nimbus-usage-${Date.now()}.${format}`;
  a.click();
  URL.revokeObjectURL(a.href);
}
