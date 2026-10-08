import kbData from "@/generated/kb.json";
import type { Chunk, KnowledgeBase } from "./types";
import { Retriever } from "./retrieval";
import { buildRetrievalQuery, type ChatMessage } from "./context";

export type { Chunk, ChatMessage };

const kb = kbData as KnowledgeBase;
export const retriever = new Retriever(kb);

export interface SourcePassage {
  /** Citation label used in the answer, e.g. "S1" */
  label: string;
  id: string;
  file: string;
  docTitle: string;
  section: string;
  date: string | null;
  text: string;
  score: number;
}

export function retrieveForConversation(messages: ChatMessage[]): {
  sources: SourcePassage[];
  products: string[];
  carriedOver: boolean;
} {
  const rq = buildRetrievalQuery(messages);
  const results = retriever.search(rq.query, { products: rq.products });
  return {
    sources: results.map((r, i) => ({
      label: `S${i + 1}`,
      id: r.chunk.id,
      file: r.chunk.file,
      docTitle: r.chunk.docTitle,
      section: r.chunk.section,
      date: r.chunk.date,
      text: r.chunk.text,
      score: Math.round(r.score * 100) / 100,
    })),
    products: rq.products,
    carriedOver: rq.carriedOver,
  };
}
