import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prepareMarkdown } from "@/lib/ui/citations";
import { fmtCost, fmtInt } from "@/lib/ui/format";
import type { Msg } from "@/lib/ui/types";

export function UserBubble({ m }: { m: Msg }) {
  return (
    <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white">
      {m.content}
    </div>
  );
}

export function AssistantBubble({ m }: { m: Msg }) {
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
