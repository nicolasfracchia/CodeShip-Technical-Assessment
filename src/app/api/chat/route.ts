import { retrieveForConversation, type ChatMessage } from "@/lib/kb";
import { runChat } from "@/lib/llm/chat";
import { getModel, modelConfig } from "@/lib/llm/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 40;
const MAX_CHARS = 4000;

function badRequest(message: string, code = "bad_request") {
  return Response.json({ type: "error", code, message }, { status: 400 });
}

function parseMessages(body: unknown): ChatMessage[] | string {
  const msgs = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return "No messages provided.";
  const out: ChatMessage[] = [];
  for (const m of msgs.slice(-MAX_MESSAGES)) {
    const role = (m as ChatMessage)?.role;
    const content = (m as ChatMessage)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return "Invalid message format.";
    if (content.length > MAX_CHARS) return `Messages are limited to ${MAX_CHARS} characters.`;
    if (content.trim()) out.push({ role, content: content.trim() });
  }
  return out;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const messages = parseMessages(body);
  if (typeof messages === "string") return badRequest(messages);

  // E10: empty / whitespace-only message -> rejected before any AI provider is called.
  const rawLast = (body as { messages: ChatMessage[] }).messages.at(-1);
  if (!rawLast || rawLast.role !== "user" || !rawLast.content?.trim()) {
    return badRequest("Please type a question first.", "empty_message");
  }

  const modelId = String((body as { modelId?: unknown }).modelId ?? modelConfig.defaultModel);
  if (!getModel(modelId)) return badRequest(`Unknown model "${modelId}".`);

  const { sources } = retrieveForConversation(messages);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runChat({ messages, modelId, sources, signal: req.signal })) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (err) {
        console.error("[chat] unexpected", err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "error", code: "internal", message: "Something went wrong on the server. Please try again." }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
