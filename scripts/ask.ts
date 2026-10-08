/** CLI client for /api/chat. Usage: npx tsx scripts/ask.ts <modelId> "question" ["follow-up" ...] */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export async function ask(modelId: string, messages: { role: "user" | "assistant"; content: string }[]) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, messages }),
  });
  if (!res.ok || !res.body) return { status: res.status, error: await res.text(), text: "", events: [] as any[] };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  const events: any[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const ev = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      events.push(ev);
      if (ev.type === "delta") text += ev.text;
      if (ev.type === "reset") text = "";
    }
  }
  return { status: res.status, text, events, done: events.find((e) => e.type === "done"), error: events.find((e) => e.type === "error") };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [modelId, ...qs] = process.argv.slice(2);
  const msgs: { role: "user" | "assistant"; content: string }[] = [];
  for (const q of qs) {
    msgs.push({ role: "user", content: q });
    const t0 = Date.now();
    const r = await ask(modelId, msgs);
    console.log(`\n>>> ${q}`);
    const src = r.events.find((e) => e.type === "sources");
    if (src) console.log("sources:", src.sources.map((s: any) => `${s.label}=${s.id}`).join(", "));
    for (const e of r.events) if (e.type === "reset") console.log(`RESET ${e.failedModelId}: ${e.kind} (${e.reason}) discarded=${e.discardedChars}`);
    console.log(r.text || r.error);
    if (r.done) console.log(`--- answered by ${r.done.modelId} | in=${r.done.usage.inputTokens} out=${r.done.usage.outputTokens} | $${r.done.cost.total.toFixed(6)} | ${Date.now() - t0}ms`);
    msgs.push({ role: "assistant", content: r.text });
  }
}
