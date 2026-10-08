# Comparison with the RTDRS Hearing Assistant

[RTDRS Hearing Assistant](https://github.com/nicolasfracchia/rtdrs-hearing-assistant) is an earlier project of mine: a fully local, real-time coach for tenants preparing for an Alberta RTDRS hearing. It transcribes a practice session (faster-whisper, pyannote), retrieves the relevant legislation from a PostgreSQL + pgvector store, and streams structured advice from a local Ollama model.

The two projects solve different problems, but both are retrieval-augmented assistants that must stay tied to their source documents. This page lists what they share and, more usefully, which [deficiencies of this project](deficiencies-and-next-steps.md) RTDRS already solves.

## Similarities

| Area | NimbusStack Knowledge Assistant | RTDRS Hearing Assistant |
|---|---|---|
| **Retrieve before generating** | BM25 over KB sections, then a grounded prompt | Hybrid search over legislation, then the excerpts go into the prompt |
| **Citable sources in the prompt** | Each passage labelled `[S1]…` with file, section, doc type and date | Each excerpt labelled with its source filename and relevance score |
| **Streaming to the browser** | NDJSON over HTTP | WebSocket |
| **Logic separated from models** | `src/lib/kb`, `src/lib/prompt.ts`, `src/lib/llm` are testable without keys | `pipeline/` and `rag/` are pure functions, testable without GPU, Ollama or a database |
| **Fast offline tests** | Vitest: retrieval, chunking, fallback, errors, cost, key exposure, validation | pytest: chunking, transcript alignment, speakers, audio, DSN redaction, prompt assembly |
| **Graceful degradation** | No keys → the app loads and says no provider is configured | No database → advice without citations; no HF token → no speaker labels |
| **Bounded client input** | 4,000 characters per message, 40 messages | 4,000 per turn, 20,000 for case context, 100 for names |
| **Secrets** | Server env only, `.env.example` documented, bundle scan | `.env` only, `.env.example` documented, connection strings redacted in logs |
| **Scripted testing without the UI** | `npm run eval`, `npm run ask` | `replay_hearing.py`, `replay_hearing.js` |
| **Honest about limits** | Known trade-offs written down (Cohere conflict miss, free-tier limits) | "Known limitations" and "Security considerations" sections, prompt injection stated as unmitigated |
| **Cheap models chosen on purpose** | Groq gpt-oss, chosen by measured eval score and free quota | `llama3.2:3b`, chosen for latency |

## Deficiencies of this project that RTDRS already covers

| Deficiency here | How RTDRS solves it | What to take over |
|---|---|---|
| **Lexical-only retrieval** tuned with hand-written synonyms (§3) | Hybrid retrieval: dense embeddings (`all-MiniLM-L6-v2`) **plus** PostgreSQL full-text search, fused with **Reciprocal Rank Fusion**, with an HNSW vector index and a GIN text index (`rag/retriever.py`, `rag/schema.sql`) | The same RRF fusion, keeping BM25 as the lexical leg so exact tokens (`403`, `v58`, `P1`) still match |
| **No ingestion pipeline**: markdown only, index rebuilt on every deploy (§3) | `rag/ingest.py` reads PDF, TXT and MD; re-ingestion is **idempotent** (upsert by source and chunk position, stale chunks deleted); `--replace` and `--list` manage what is indexed; documents are **tagged** (`law`, `rtdrs`, `case`) for filtered search | A persistent store and an ingest command, so documents change without a redeploy, and tags (product, doc type) as filters instead of regexes |
| **Chunking only works for short sections** (§3) | Generic overlapping, sentence-aware splitter (`rag/chunking.py`): 600 characters, 100 overlap, minimum size, with a tested fallback order of boundaries | Use it for long sections, after splitting by heading and keeping tables whole |
| **Free-text answers that can't be checked** (§1) | The model must return a **fixed JSON schema** (`overall`, `tone`, `items[]`, `suggested_response`); the UI parses it and shows a "Raw response" card when parsing fails instead of breaking | The same pattern with citation labels on each answer block. This is the prerequisite for the verification step |
| **Open public endpoint** (§7) | WebSocket **origin allowlist**, optional **shared token** compared in constant time (`pipeline/security.py`), one session at a time, loud warning when bound beyond localhost | A shared demo token or per-IP limit now; SSO for the real tool |
| **Nothing is logged** (§6) | Every session is appended to a timestamped **`.jsonl` transcript**; structured logging with `--log-level`; secrets redacted from logs (`rag/dsn.py`) | A JSONL interaction log (question, passage IDs, model, latency, tokens) as the first step towards a review queue |
| **No CI, no linter** (§8) | GitHub Actions runs `ruff check` and `pytest` on every push and pull request, with a CI badge in the README | The same workflow with `tsc`, `vitest` and `next build` |
| **No environment check** | `scripts/check_environment.py` verifies every dependency in order and estimates end-to-end latency | A `check:keys` script that calls each configured provider once and prints which ones work |
| **Duplicate model calls not guarded on the server** | A per-session lock stops the debounce timer and the "Advice" button from running two model calls at once | Server-side protection against parallel requests from the same session |
| **No license** | MIT `LICENSE` | Add one before making the repo public |
| **Human responsibility not stated in the UI** (§ models vs. humans) | "Not legal advice" disclaimer at the top of the README and the tool | A short "verify before committing to a customer" note on pricing, SLA and compatibility answers |

## Where this project is ahead

For balance, these exist here and not in RTDRS:

- **Multi-provider fallback** with timeouts, `reset` events and the answering model reported. RTDRS depends on one local model.
- **A live eval suite** that checks answer content (20 cases, including a false-conflict case). RTDRS tests prompt assembly but never grades the advice.
- **Conflict handling** between documents (E4), with dates in the citations.
- **Token and cost tracking** per message and per session, the context-window meter, and usage export.
- **Source passages shown under each answer**, so users can check them.
- **A public deployment** and a bundle scan proving no key reaches the browser.

## Still missing in both

Neither project does these yet. They are the shared next steps:

1. **Post-generation verification**: checking that every citation exists and every figure appears in its cited source.
2. **A reranker** after first-stage retrieval.
3. **A feedback loop**: user ratings and a review queue that turns failures into document fixes and eval cases.
4. **A held-out eval set** written by real users, run on every change.
5. **Prompt injection defences** beyond prompt instructions.
