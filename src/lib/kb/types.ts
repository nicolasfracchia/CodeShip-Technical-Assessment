export type Product = "relay" | "vault" | "pulse" | "ledger";

export type DocType = "product" | "release-notes" | "company";

export interface Chunk {
  /** Stable id, e.g. "relay.md#pricing" */
  id: string;
  file: string;
  /** Document title, e.g. "Nimbus Relay" */
  docTitle: string;
  /** Section heading, e.g. "Pricing" or "4.2 (2026-06-10)" */
  section: string;
  product: Product | null;
  docType: DocType;
  /** "updated" date of the document (product/company docs) or release date (release notes) */
  date: string | null;
  /** Release version for release-note sections, e.g. "4.2" */
  version: string | null;
  /** Verbatim markdown of the section (what users see as the source passage) */
  text: string;
}

export interface KnowledgeBase {
  builtAt: string;
  chunks: Chunk[];
}
