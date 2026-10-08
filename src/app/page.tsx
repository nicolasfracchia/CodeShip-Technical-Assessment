"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StreamEvent, Failure } from "@/lib/events";
import type { SourcePassage } from "@/lib/kb";
import type { PublicModel } from "@/lib/llm/config";
import { prepareMarkdown } from "@/lib/ui/citations";

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface Msg {
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

const uid = () => Math.random().toString(36).slice(2);
const fmtCost = (n: number) => (n === 0 ? "$0" : n < 0.0001 ? "<$0.0001" : `$${n.toFixed(4)}`);
const fmtInt = (n: number) => n.toLocaleString("en-US");


const SUGGESTIONS = [
  "What are the key differences between the Pro and Enterprise pricing tiers?",
  "Does Vault integrate with Salesforce? What version is required?",
  "What new features were released in v4.2 of Relay?",
  "A client is getting a 403 on the API. What should they check first?",
  "Which of our products support SSO via SAML 2.0?",
  "What's the SLA for Priority 1 support tickets?",
];

export default function ChatPage() {
  const [models, setModels] = useState<PublicModel[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d: { defaultModel: string; models: PublicModel[] }) => {
        setModels(d.models);
        setModelId(d.defaultModel);
      })
      .catch(() => setBanner("Could not load the model list. Refresh the page."));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const selected = models.find((m) => m.id === modelId);

  const totals = useMemo(() => {
    const done = messages.filter((m) => m.usage);
    return {
      inputTokens: done.reduce((s, m) => s + (m.usage?.inputTokens ?? 0), 0),
      outputTokens: done.reduce((s, m) => s + (m.usage?.outputTokens ?? 0), 0),
      cost: done.reduce((s, m) => s + (m.usage?.cost ?? 0), 0),
      count: done.length,
    };
  }, [messages]);

  // Context-window estimate for the NEXT request on the currently selected model:
  // the last request's input + its answer (both are re-sent next time). Recomputed on model switch (E7).
  const context = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.usage);
    const used = last?.usage ? last.usage.inputTokens + last.usage.outputTokens : 0;
    const window = selected?.contextWindow ?? 0;
    const pct = window ? (used / window) * 100 : 0;
    return { used, window, pct, level: pct >= 90 ? "red" : pct >= 75 ? "amber" : "ok" };
  }, [messages, selected]);

  function patch(id: string, fn: (m: Msg) => Msg) {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }

  async function send(text: string) {
    const content = text.trim();
    // E10: blank input never reaches the server or any AI provider.
    if (!content || busy || !modelId) return;
    setBanner(null);
    setInput("");

    const userMsg: Msg = { id: uid(), role: "user", content };
    const botId = uid();
    const history = [...messages.filter((m) => m.status !== "error"), userMsg];
    setMessages((prev) => [...prev, userMsg, { id: botId, role: "assistant", content: "", status: "streaming", notices: [] }]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          modelId,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ message: `Request failed (${res.status}).` }));
        patch(botId, (m) => ({ ...m, status: "error", content: err.message }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handleEvent(botId, JSON.parse(line) as StreamEvent);
        }
      }
      setMessages((prev) => prev.map((m) => (m.id === botId && m.status === "streaming" ? { ...m, status: "done" } : m)));
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        patch(botId, (m) => ({ ...m, status: "stopped" }));
      } else {
        patch(botId, (m) => ({ ...m, status: "error", content: "Connection lost. Check your network and try again." }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleEvent(botId: string, ev: StreamEvent) {
    switch (ev.type) {
      case "sources":
        patch(botId, (m) => ({ ...m, sources: ev.sources }));
        break;
      case "start":
        patch(botId, (m) => ({ ...m, modelName: ev.modelName, modelId: ev.modelId }));
        break;
      case "delta":
        patch(botId, (m) => ({ ...m, content: m.content + ev.text }));
        break;
      case "reset":
        // E8: drop partial output from the failed model; the backup starts clean.
        patch(botId, (m) => ({
          ...m,
          content: "",
          notices: [...(m.notices ?? []), `${ev.failedModelName}: ${ev.reason} Switching to the backup model…`],
        }));
        break;
      case "done":
        patch(botId, (m) => ({
          ...m,
          status: "done",
          modelId: ev.modelId,
          modelName: ev.modelName,
          requestedModelName: ev.requestedModelName,
          failures: ev.failures,
          notices: ev.truncated
            ? [...(m.notices ?? []), "This answer hit the model's length limit and may be incomplete. Ask a narrower question for the rest."]
            : m.notices,
          usage: { inputTokens: ev.usage.inputTokens, outputTokens: ev.usage.outputTokens, cost: ev.cost.total },
        }));
        break;
      case "error":
        patch(botId, (m) => ({ ...m, status: "error", content: ev.message, failures: ev.failures }));
        break;
    }
  }

  function newConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setBanner(null);
  }

  function exportUsage(format: "csv" | "json") {
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

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-base font-semibold">NimbusStack Knowledge Assistant</h1>
            <p className="text-xs text-slate-500">Answers come only from NimbusStack product documentation.</p>
          </div>
          <button
            onClick={newConversation}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
          >
            New Conversation
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-4xl flex-wrap items-center gap-3 text-xs">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="font-medium text-slate-600">Model</span>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              aria-label="AI model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available}>
                  {m.providerLabel} · {m.name}
                  {m.available ? "" : ` (unavailable: ${m.unavailableReason})`}
                </option>
              ))}
            </select>
          </label>
          <span className="rounded bg-slate-100 px-2 py-1 text-slate-600" title="Session totals">
            Session: {fmtInt(totals.inputTokens)} in · {fmtInt(totals.outputTokens)} out · {fmtCost(totals.cost)}
          </span>
          <div className="flex gap-1">
            <button
              disabled={!totals.count}
              onClick={() => exportUsage("csv")}
              className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              CSV
            </button>
            <button
              disabled={!totals.count}
              onClick={() => exportUsage("json")}
              className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              JSON
            </button>
          </div>
        </div>
        {selected && (
          <div className="mx-auto mt-2 max-w-4xl text-xs text-slate-500">
            {selected.description} · {fmtInt(selected.contextWindow)} token context · ${selected.pricing.inputPerMTok}/$
            {selected.pricing.outputPerMTok} per 1M tokens (in/out, list price)
          </div>
        )}
        {selected && (
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
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          {banner && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{banner}</div>}
          {messages.length === 0 && (
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Ask about Nimbus Relay, Vault, Pulse or Ledger: pricing, integrations, release notes, SLAs, troubleshooting.
              </p>
              <div className="mx-auto mt-4 grid max-w-3xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-left text-sm hover:border-slate-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} m={m} /> : <AssistantBubble key={m.id} m={m} />))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <form
          className="mx-auto flex max-w-4xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask a product question… (Enter to send, Shift+Enter for a new line)"
            className="max-h-40 min-h-[42px] flex-1 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            aria-label="Your question"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !modelId}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}

function UserBubble({ m }: { m: Msg }) {
  return (
    <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white">
      {m.content}
    </div>
  );
}

function AssistantBubble({ m }: { m: Msg }) {
  const fellBack = m.status === "done" && m.requestedModelName && m.modelName && m.requestedModelName !== m.modelName;
  return (
    <div className="max-w-full rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      {m.notices?.map((n, i) => (
        <div key={i} className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          {n}
        </div>
      ))}

      {m.status === "error" ? (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700" role="alert">
          {m.content}
        </div>
      ) : m.content ? (
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{prepareMarkdown(m.content)}</ReactMarkdown>
          {m.status === "streaming" && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-slate-400 align-middle" />}
        </div>
      ) : m.status === "streaming" ? (
        <div className="text-slate-500">
          <span className="animate-pulse">{m.modelName ? `${m.modelName} is thinking…` : "Searching the knowledge base…"}</span>
        </div>
      ) : (
        <div className="text-slate-500">Stopped.</div>
      )}

      {m.status === "stopped" && m.content && <div className="mt-1 text-xs text-slate-500">(stopped)</div>}

      {(m.status === "done" || m.status === "stopped") && m.modelName && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <span>
            Answered by <strong className="text-slate-700">{m.modelName}</strong>
            {fellBack && <span className="text-amber-700"> (backup: {m.requestedModelName} was unavailable)</span>}
          </span>
          {m.usage && (
            <span>
              {fmtInt(m.usage.inputTokens)} in · {fmtInt(m.usage.outputTokens)} out · {fmtCost(m.usage.cost)}
            </span>
          )}
        </div>
      )}

      {m.sources && m.status !== "error" && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-800">
            {m.sources.length ? `Sources (${m.sources.length} passages)` : "No matching passages in the knowledge base"}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {m.sources.map((s) => (
              <div key={s.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="mb-1 font-medium text-slate-700">
                  <code className="mr-1 rounded bg-indigo-100 px-1 text-indigo-700">{s.label}</code>
                  {s.docTitle} › {s.section}
                  <span className="font-normal text-slate-500">
                    {" "}
                    · {s.file}
                    {s.date ? ` · ${s.date}` : ""}
                  </span>
                </div>
                <div className="prose-chat prose-source">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.text}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
