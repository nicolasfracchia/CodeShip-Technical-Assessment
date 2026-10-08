import type { Product } from "./types";
import { detectProducts, tokenize } from "./retrieval";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RetrievalQuery {
  /** Text sent to the retriever */
  query: string;
  /** Products to scope to; empty = all products (fan-out) */
  products: Product[];
  /** True when products/topic were carried over from earlier turns */
  carriedOver: boolean;
}

/**
 * Builds the retrieval query for the latest user message (edge case E1).
 * Deterministic, so it is fast, free and testable without an extra LLM call:
 *  - If the message names no product, inherit the products from the most recent
 *    earlier message (user first, then assistant) that named one.
 *    "what about its SLA?" after a Vault question -> Vault SLA.
 *  - If the message is short / topic-less ("and Enterprise?"), also append the
 *    previous user question so the topic carries over.
 */
export function buildRetrievalQuery(messages: ChatMessage[]): RetrievalQuery {
  const last = messages[messages.length - 1]?.content ?? "";
  const history = messages.slice(0, -1);
  const prevUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  let products = detectProducts(last);
  let carriedOver = false;
  let query = last;

  const refersBack = /\b(it|its|it's|this|that|they|them|their|same|those|these|what about|how about|and for|and the)\b/i.test(last);

  if (products.length === 0 && history.length > 0) {
    for (const m of [...history].reverse()) {
      if (m.role !== "user") continue;
      const found = detectProducts(m.content);
      if (found.length) {
        products = found;
        carriedOver = true;
        break;
      }
    }
    // A cross-product question ("which of our products...") stays unscoped unless the user refers back.
    if (carriedOver && !refersBack && /\b(which|all|every|each|our) (of )?(our )?products?\b/i.test(last)) {
      products = [];
      carriedOver = false;
    }
  }

  if (history.length > 0 && (tokenize(last).length < 3 || refersBack) && prevUser) {
    query = `${last}\n${prevUser}`;
    carriedOver = true;
  }

  return { query, products, carriedOver };
}
