"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AssistantBubble, UserBubble } from "@/components/chat/MessageBubbles";
import { ContextMeter, contextUsage } from "@/components/chat/ContextMeter";
import type { StreamEvent } from "@/lib/events";
import type { PublicModel } from "@/lib/llm/config";
import { fmtCost, fmtInt, uid } from "@/lib/ui/format";
import type { Msg, SessionTotals } from "@/lib/ui/types";
import { exportUsage } from "@/lib/ui/usage-export";

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

  const totals = useMemo<SessionTotals>(() => {
    const done = messages.filter((m) => m.usage);
    return {
      inputTokens: done.reduce((s, m) => s + (m.usage?.inputTokens ?? 0), 0),
      outputTokens: done.reduce((s, m) => s + (m.usage?.outputTokens ?? 0), 0),
      cost: done.reduce((s, m) => s + (m.usage?.cost ?? 0), 0),
      count: done.length,
    };
  }, [messages]);

  const context = useMemo(() => contextUsage(messages, selected), [messages, selected]);

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
              onClick={() => exportUsage(messages, totals, "csv")}
              className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              CSV
            </button>
            <button
              disabled={!totals.count}
              onClick={() => exportUsage(messages, totals, "json")}
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
        {selected && <ContextMeter context={context} />}
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
