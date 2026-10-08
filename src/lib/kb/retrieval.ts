import { PRODUCTS, type Chunk, type KnowledgeBase, type Product } from "./types";

/**
 * Lexical retrieval tuned for a small, structured KB:
 *  1. Domain synonym expansion ("single sign-on" -> sso, saml, federated, oidc...)
 *  2. BM25 over section text + a header line (product name, doc title, section)
 *  3. Product scoping: named products (or ones carried over from the conversation)
 *     restrict results; with no product named, fan out and take the best chunks
 *     *per product* so "which of our products..." questions are complete.
 *  4. Version boost: "v4.2" pulls in the matching release-notes section.
 */

const PRODUCT_ALIASES: Record<Product, RegExp> = {
  relay: /\brelay\b|\bapi gateway\b|\bevent router\b/i,
  vault: /\bvault\b|\bsecrets? (manager|store|storage)\b/i,
  pulse: /\bpulse\b|\bproduct analytics\b/i,
  ledger: /\bledger\b|\b(usage[- ]based )?billing\b|\binvoic/i,
};

const STOPWORDS = new Set(
  (
    "a an the and or but if of to in on for with at by from as is are was were be been being do does did " +
    "it its this that these those what which who whom how why when where can could should would will shall may might " +
    "i we you they he she our your their my me us them there here about into than then so not no yes any all each " +
    "have has had get gets got please tell show give know need want just also more most some such very nimbus nimbusstack " +
    "product products"
  ).split(" "),
);

/** Each group: if the query contains any trigger (token or phrase), all expansions are added. */
const SYNONYM_GROUPS: { triggers: string[]; expand: string[] }[] = [
  {
    triggers: ["sso", "saml", "single sign-on", "single sign on", "signon", "sign-on", "federated", "oidc", "openid", "okta", "identity provider", "idp", "login", "log in", "sign in", "sign-in"],
    expand: ["sso", "saml", "single", "sign", "federated", "login", "oidc", "openid", "identity", "okta"],
  },
  {
    // Note: bare "support" is deliberately not a trigger ("which products support SSO" is not an SLA question).
    triggers: ["sla", "response time", "respond", "priority", "p1", "p2", "p3", "p4", "ticket", "tickets", "urgent", "outage", "support plan", "support team", "support level"],
    expand: ["sla", "support", "response", "priority", "reply", "p1", "p2", "p3", "p4", "hours"],
  },
  {
    triggers: ["price", "prices", "pricing", "cost", "costs", "tier", "tiers", "plan", "plans", "pro", "enterprise", "starter", "growth", "cheaper", "expensive", "seat", "seats"],
    expand: ["pricing", "price", "tier", "starter", "pro", "enterprise", "growth", "seat", "month"],
  },
  {
    triggers: ["403", "forbidden", "permission", "denied", "unauthorized", "401", "access denied"],
    expand: ["403", "forbidden", "troubleshooting", "scope", "token", "key"],
  },
  {
    triggers: ["429", "rate limit", "rate-limit", "throttle", "throttled", "too many requests"],
    expand: ["429", "rate", "limit", "x-ratelimit-reset", "troubleshooting"],
  },
  {
    triggers: ["error", "errors", "troubleshoot", "troubleshooting", "failing", "fails", "broken", "check first", "debug"],
    expand: ["troubleshooting", "check"],
  },
  {
    triggers: ["integrate", "integration", "integrations", "connector", "connect", "compatible", "compatibility", "sync", "salesforce", "slack", "datadog", "stripe", "netsuite", "segment", "snowflake", "github", "aws"],
    expand: ["integration", "integrations", "partner", "requirement", "minimum", "version"],
  },
  {
    triggers: ["release", "released", "releases", "new", "changelog", "what's new", "whats new", "launched", "shipped", "update", "updates", "fixed"],
    expand: ["release", "notes", "new", "fixed"],
  },
  {
    triggers: ["security", "encryption", "encrypt", "encrypted", "tls", "aes", "compliance", "questionnaire"],
    expand: ["security", "encrypt", "aes-256", "tls", "data", "handling"],
  },
  {
    triggers: ["audit", "retention", "logs"],
    expand: ["audit", "log", "retention"],
  },
  {
    triggers: ["business hours", "24x7", "24/7", "weekend", "holiday", "time zone", "timezone"],
    expand: ["business", "hours", "24x7", "time", "zone"],
  },
];

const VERSION_RE = /\bv?(\d+\.\d+)\b/gi;
const RELEASE_INTENT_RE = /\b(release|released|releases|new in|what'?s new|changelog|version|v\d+\.\d+)\b/i;
const ALL_PRODUCTS_INTENT_RE = /\b(which|all|every|each|any) (of )?(our |the )?(nimbus )?products?\b|\bour products\b|\bacross (the )?products\b/i;

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+(?:[.\-][a-z0-9]+)*/g) ?? [];
  const out: string[] = [];
  for (const tok of raw) {
    if (STOPWORDS.has(tok)) continue;
    out.push(stem(tok));
    // Also index hyphenated parts: "x-ratelimit-reset" -> x, ratelimit, reset
    if (tok.includes("-")) for (const part of tok.split("-")) if (part && !STOPWORDS.has(part)) out.push(stem(part));
  }
  return out;
}

function stem(t: string): string {
  if (/^\d/.test(t) || t.length <= 3) return t;
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("sses")) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us")) return t.slice(0, -1);
  return t;
}

export function detectProducts(text: string): Product[] {
  return PRODUCTS.filter((p) => PRODUCT_ALIASES[p].test(text));
}

export function detectVersions(text: string): string[] {
  return [...text.matchAll(VERSION_RE)].map((m) => m[1]).filter((v) => v !== "2.0"); // "SAML 2.0" is not a release
}

export function expandQuery(text: string): string[] {
  const lower = text.toLowerCase();
  const base = tokenize(text);
  const tokenSet = new Set(base);
  const extra: string[] = [];
  for (const g of SYNONYM_GROUPS) {
    const hit = g.triggers.some((t) => (t.includes(" ") || t.includes("-") || t.includes("/") ? lower.includes(t) : tokenSet.has(stem(t))));
    if (hit) extra.push(...g.expand.flatMap((e) => tokenize(e)));
  }
  return [...base, ...extra];
}

// ---------- BM25 index ----------

interface IndexedChunk {
  chunk: Chunk;
  tf: Map<string, number>;
  len: number;
}

export class Retriever {
  private docs: IndexedChunk[];
  private df = new Map<string, number>();
  private avgLen: number;

  constructor(private kb: KnowledgeBase) {
    this.docs = kb.chunks.map((chunk) => {
      const header = `${chunk.docTitle} ${chunk.section} ${chunk.docType === "release-notes" ? "release notes new" : ""}`;
      // Header is repeated so section/product names weigh more than body mentions.
      const tokens = tokenize(`${header} ${header} ${chunk.text}`);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      return { chunk, tf, len: tokens.length };
    });
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / this.docs.length;
  }

  get chunks(): Chunk[] {
    return this.kb.chunks;
  }

  private bm25(d: IndexedChunk, terms: Map<string, number>): number {
    const k1 = 1.2;
    const b = 0.75;
    const N = this.docs.length;
    let score = 0;
    for (const [term, qWeight] of terms) {
      const f = d.tf.get(term);
      if (!f) continue;
      const n = this.df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += qWeight * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / this.avgLen)));
    }
    return score;
  }

  search(query: string, opts: SearchOptions = {}): ScoredChunk[] {
    const products = opts.products ?? detectProducts(query);
    const versions = detectVersions(query);
    const releaseIntent = RELEASE_INTENT_RE.test(query);
    const allProducts = products.length === 0 || ALL_PRODUCTS_INTENT_RE.test(query);

    // Base query terms weigh 1, synonym expansions weigh 0.5.
    const terms = new Map<string, number>();
    const baseTokens = tokenize(query);
    for (const t of expandQuery(query)) terms.set(t, Math.max(terms.get(t) ?? 0, 0.5));
    for (const t of baseTokens) terms.set(t, 1);
    // Product names are handled by scoping, not scoring.
    for (const p of PRODUCTS) terms.delete(p);

    const scored: ScoredChunk[] = this.docs.map((d) => {
      let score = this.bm25(d, terms);
      const c = d.chunk;
      if (versions.length && c.version && versions.includes(c.version)) score += 8;
      if (releaseIntent && c.docType === "release-notes") score *= 1.5;
      return { chunk: c, score };
    });

    const minScore = opts.minScore ?? 1.0;
    const relevant = scored.filter((s) => s.score >= minScore).sort((a, b) => b.score - a.score);
    const perProduct = opts.perProduct ?? 2;
    const limit = opts.limit ?? 10;

    const picked = new Map<string, ScoredChunk>();
    const add = (s: ScoredChunk) => picked.has(s.chunk.id) || picked.set(s.chunk.id, s);

    if (!allProducts) {
      // Scoped: chunks of the named products, plus company-wide docs that match.
      for (const s of relevant) {
        if (s.chunk.product && products.includes(s.chunk.product)) add(s);
      }
      // Always give the model this product's release notes when versions/releases are asked.
      if (releaseIntent) {
        for (const s of scored)
          if (s.chunk.docType === "release-notes" && s.score > 0 && s.chunk.product && products.includes(s.chunk.product)) add(s);
      }
      relevant.filter((s) => s.chunk.product === null).slice(0, 2).forEach(add);
    } else {
      // Fan out: best chunks for every product, so cross-product answers are complete.
      for (const p of PRODUCTS) relevant.filter((s) => s.chunk.product === p).slice(0, perProduct).forEach(add);
      relevant.filter((s) => s.chunk.product === null).slice(0, 2).forEach(add);
      if (versions.length) scored.filter((s) => s.chunk.version && versions.includes(s.chunk.version)).forEach(add);
    }

    return [...picked.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export interface SearchOptions {
  /** Override product detection (e.g. products carried over from earlier messages). */
  products?: Product[];
  perProduct?: number;
  limit?: number;
  minScore?: number;
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}
