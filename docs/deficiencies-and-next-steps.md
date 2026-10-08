# Deficiencies, fixes and next steps

An honest review of the NimbusStack Knowledge Assistant as submitted. It covers what is weak, why, how to fix it, which order to fix it in to get the best possible outcome for every question asked, and where the system should rely on models versus people.

The build meets the brief: the live eval passes 20/20 on the default model, and keys never reach the browser. The weaknesses below are about what happens **beyond the 20 questions we tested**, with real employees, a growing knowledge base and real money on the keys.

---

## 1. Grounding is enforced by the prompt, never checked afterwards

**What is wrong.** Every grounding rule (only facts from sources, cite every claim, say "not in the knowledge base", flag disagreements) is an instruction in `src/lib/prompt.ts`. Nothing checks the answer after it is generated:

- A citation label that doesn't exist (`[S12]` when there are 8 sources) still renders as a citation chip (`src/lib/ui/citations.ts`).
- An uncited sentence, or a number that appears in no source, reaches the user unflagged.
- When retrieval finds **no** passage at all, the model is still called and asked to say "not in the knowledge base". That costs a call and relies on the model to comply.
- **A concrete wrong answer that passes today.** For Q6 (P1 SLA), the default model builds one table with Starter / Pro / Enterprise columns and puts Pulse's *Growth* value ("Next business day") under **Starter**. Pulse has no Starter tier. Every cell carries a correct-looking `[S1]` citation, the value itself is right, and the eval passes because its regexes only look for the durations (`docs/eval-results.md`, Q6; reproduced live on 2026-10-08). The KB notes even list this trap ([architecture](architecture.md#what-the-knowledge-base-gets-wrong-or-leaves-ambiguous), item 7).

**Why it matters.** "Answers that don't come from the documents" is the one automatic fail in the brief, and for Sarah (sales, live calls) it is the real business risk. Prompt compliance varies by model and by run: temperature 0 is not deterministic across providers, and the fallback models were tuned less than the default.

**How to fix.**
1. **Short-circuit E2 in code.** If retrieval returns zero passages, reply with the fixed "not in the knowledge base" sentence without calling a model.
2. **Ask for structured output.** Have the model return JSON (answer blocks, each with its citation labels, plus `conflicts[]` and `missing[]`) instead of free markdown, then render it. The RTDRS project already does this (see [comparison](comparison-with-rtdrs.md)).
3. **Verify before showing.** Run cheap deterministic checks on the result: every label exists; every block cites something; every number, price, version and duration in a block appears verbatim in one of its cited passages; every tier name used appears in the cited passage (this catches the Pulse "Starter" error above). If a check fails, regenerate once (or with the next model). If it still fails, show the answer with an "unverified" banner instead of presenting it as fact.
4. **Optional second pass.** For high-stakes intents (pricing, contracts), add a small LLM judge that checks "is every claim supported by the cited text?" (an entailment check). It flags problems; it never rewrites the answer.

## 2. Conflict detection depends on the model, and it misses some

**What is wrong.** E4 relies on prompt rule 5 plus a date-based staleness note on company-wide summaries. That note never fires for conflicts *between a product page and its own release notes*. The committed eval output shows a miss: for Ledger + Salesforce, `ledger.md` lists it as "coming soon in the 2.6 roadmap", but the **2.6 release notes themselves** (2026-06-25) say it "is planned for a later release", so it did not ship in 2.6. The answer repeats "coming soon in the 2.6 roadmap", cites both passages, and flags nothing (`docs/eval-results.md`, Q2-ledger). The case passes because its regex only checks for "roadmap". The Cohere fallback also misses the Vault SAML conflict ([architecture](architecture.md#key-decisions)).

**Why.** Spotting a conflict means comparing values across passages at answer time, under latency pressure, with whichever model happens to answer. That is the least reliable place to do it.

**How to fix.** Move conflict detection **to ingestion time**:
1. When the KB is built, an LLM extracts facts as structured rows (`product, tier, attribute, value, source, date`), e.g. `vault, pro, saml, yes, vault.md, 2026-07-03`.
2. Plain code groups rows by `(product, tier, attribute)` and lists every group with more than one value. That is the candidate conflict list.
3. **A human (the doc owner) reviews each candidate**: real conflict, stale doc, or not a conflict. The result goes into a `conflicts.json` registry.
4. At answer time, any registered conflict that touches the retrieved passages is injected into the prompt, and the UI shows it as a dedicated callout. Detection then no longer depends on which model answered.

## 3. Retrieval and follow-ups are hand-tuned to these ten files

**What is wrong.**
- Product aliases, the synonym map, the integration keyword list, the "release intent" regexes and the staleness check (`text.includes("nimbus <product>")`) all encode knowledge of *this* KB in code (`retrieval.ts`, `prompt.ts`).
- Some aliases are too broad: "billing" and "invoice" map to Ledger, so "Does Relay show billing usage?" pulls in Ledger as well.
- Follow-ups (E1) use a pronoun regex and "carry over the last named product". That breaks on references like "the second one", "the cheaper tier", or a topic change with no product name. Turns the history trimmer drops are still used for retrieval.
- Whole-section chunks work because every section here is short. An "80-page PDF manual" (the brief's real-world source) would produce huge chunks or none at all.
- The index is built at deploy time, so any document change needs a redeploy. There is no ingestion for PDFs, wikis or email threads.

**Why.** These were the right calls for a 60-minute build on a 38-section KB: deterministic, free and unit-tested. They don't scale to new products, new documents or different wording.

**How to fix.**
1. Move domain vocabulary (products, aliases, synonyms) into `config/kb.json` next to `models.json`, so adding a product is a config change.
2. Use **hybrid retrieval**: keep BM25 for exact tokens (`403`, `v58`, `P1`) and add embeddings for paraphrases, fused with Reciprocal Rank Fusion, then a small reranker. The RTDRS project already implements dense + full-text + RRF on pgvector.
3. Replace the follow-up regex with an **LLM query rewrite** ("rewrite the last question so it stands alone"). Keep the current deterministic logic as the fallback when the rewrite call fails or times out, and log both outputs so the two can be compared.
4. Chunk by heading, then by size with overlap for long sections. Keep table rows with their header row (E6).
5. Build an ingestion pipeline (PDF, HTML and markdown → chunks → index) with idempotent re-ingestion, run on document change rather than on deploy.

## 4. The fallback chain is not quality-gated, and its timing can exceed the function limit

**What is wrong.**
- Every model with a key is in the chain, but only the default was tuned and fully evaluated. A user who gets a fallback answer gets a measurably weaker one (see the Cohere case above), and only a small "backup" note tells them.
- `chat.ts` allows 4 attempts with a 20 s first-token timeout each (80 s worst case), and an attempt that keeps streaming slowly has no total cap. The route declares `maxDuration = 60`. On Vercel, the function can be killed mid-answer. The stream then ends with no `done` or `error` event, and the browser marks the partial text as a finished answer with no usage and no warning.
- Tokens spent by failed attempts (including partial streams that were reset) are not counted in usage or cost.

**How to fix.**
1. Put a model in `fallbackOrder` only if it passes the eval suite above a threshold. Run the suite per model on a schedule.
2. Give the whole request a deadline (for example 50 s). Stop starting new attempts when the deadline is near, and always end the stream with an `error` event. On the client, treat a stream that ends without `done` or `error` as an error, not as a finished answer.
3. Record failed attempts' usage and show it as "spent on failed attempts" in the session totals.

## 5. The eval measures the questions the prompt was tuned on

**What is wrong.** The 20 eval cases are the brief's own questions, and the prompt was adjusted until they passed (the integration reminder exists because of Q2). Each case runs once, on one model, with regex checks, by hand. A regex can pass an answer that misses the point: Q2-ledger and Q6 (sections 1 and 2) both pass while containing errors.

**Why it matters.** 20/20 shows the system handles these questions. It doesn't show it handles the next 200, and it doesn't catch regressions when a prompt or model changes.

**How to fix.**
1. Keep a **held-out set**: questions written by Sales, Support and Training staff that are never used to tune the prompt.
2. Run each case several times on every model in the chain and report pass rates, not pass/fail.
3. Add an LLM-judge score for faithfulness and completeness next to the regexes, and have a human grade a sample each run to keep the judge honest.
4. Run the offline tests and a small live eval in CI on every pull request, and block prompt, model or retrieval changes that lower the scores.

## 6. Nothing is learned from real use

**What is wrong.** The app keeps no log of questions, retrieved passages, answers, fallback events or latency (only `console.error` on failures), and users have no way to say an answer was wrong.

**Why it matters.** The most valuable signals (questions the KB can't answer, answers people distrust, products that keep falling back) are thrown away. Nina (training) can't see which documents are missing.

**How to fix.** Log every interaction as a structured record (question, rewritten query, passage IDs, model, verification result, latency, tokens), with retention rules agreed with NimbusStack. Add 👍/👎 and "report a wrong answer" to each reply. Send 👎, failed verifications and "not in KB" answers to a review queue (section 9).

## 7. The public endpoint has no abuse protection

**What is wrong.** `/api/chat` has no authentication and no rate limit. Anyone with the URL can use up the free-tier quotas for every tester, and once paid keys (Claude, OpenAI) are added, spend real money. The server also trusts the conversation history the browser sends, so a caller can forge earlier "assistant" turns. The system prompt tells the model to ignore them as a fact source, but that is again only a prompt rule.

**How to fix.** For the demo, add a per-IP rate limit and a daily token budget per deployment. For the real internal tool, put it behind NimbusStack's SSO (which also gives per-user audit logs), and keep the conversation on the server, or sign it, so history can't be forged.

## 8. Smaller gaps

| Gap | Fix |
|---|---|
| The context meter uses the last request's tokens and doesn't count the next question and its sources. History trimming for small windows (24K Cloudflare) drops turns **silently** | Estimate the next request's size, and send a `trimmed` event so the UI can say "older messages were left out" |
| No browser tests for streaming, `reset` (E8) and the context meter on model switch (E7) | Playwright tests with a fake provider (the `StreamFn` seam already exists) |
| No linter, no CI | ESLint (Next 16 removed `next lint`) plus a GitHub Actions workflow running `typecheck`, `test` and `build` |
| Claude and OpenAI are placeholders that have never been called, so usage reporting through Anthropic's OpenAI-compatible endpoint is untested | Run the eval against both as soon as keys exist |
| Costs are shown at paid list prices while the real charge is $0 | Keep the estimate, and label it "at list price" next to the session total, not only in the model description |
| No answer for "what does the KB cover?" | Generate a coverage summary at build time and show it on the empty screen |

---

## Getting the best outcome for each question

What every question should go through, in order. ✅ exists today, 🔶 partial, ⬜ missing.

| # | Stage | Today | Target |
|---|---|---|---|
| 1 | **Validate** input | ✅ blank, size and format checks (E10) | Add a rate limit and user identity |
| 2 | **Understand** the question | 🔶 product detection and pronoun carry-over by regex | LLM rewrite to a standalone question plus structured filters (product, tier, version); ask a clarifying question when the product is genuinely ambiguous and answering for all four would be noise |
| 3 | **Retrieve** | 🔶 BM25 with synonyms and per-product fan-out | Hybrid search with a reranker and a confidence threshold; zero passages → "not in the KB" without calling a model |
| 4 | **Attach known conflicts** | 🔶 date-based hint, company-wide docs only | Human-reviewed conflict registry injected whenever a conflicting passage is retrieved |
| 5 | **Generate** | ✅ strict grounding prompt, temperature 0, measured reasoning effort | Structured JSON output: answer blocks with citations, `conflicts[]`, `missing[]` |
| 6 | **Verify** | ⬜ | Citation labels exist, every block is cited, every number appears in its cited passage; one retry, then an "unverified" banner |
| 7 | **Fall back** | ✅ chain with `reset`, timeouts and clear errors | Only eval-qualified models; one deadline for the whole request; failed-attempt cost counted |
| 8 | **Present** | ✅ citations, source passages, model, tokens and cost | Dedicated conflict callout; "copy with citations" for sales; verification badge |
| 9 | **Learn** | ⬜ | Interaction log, 👍/👎, review queue, held-out eval grown from real questions |

### Recommended order

1. **This week** (cheap, highest risk reduction): zero-passage short-circuit; request deadline and client handling of cut streams; rate limit and token budget; CI running the offline tests.
2. **Next two weeks**: structured output plus deterministic verification; interaction logging and feedback buttons; per-model eval to qualify the fallback chain.
3. **Next month**: ingestion pipeline and hybrid retrieval; conflict registry with owner review; LLM query rewrite; held-out eval set from real users; SSO.

---

## Where to rely on models, and where people must be involved

The rule: **models read and write language; code enforces the rules; people decide what is true and what is acceptable.**

### Rely on models entirely

These are language tasks where a mistake is cheap, gets caught by a later check, or both.

| Task | Why a model is safe here |
|---|---|
| Writing the answer from the retrieved passages | Grounded in supplied text, checked by verification (stage 6) |
| Formatting: tables per tier, bullets, a lead sentence | Pure presentation |
| Rewriting follow-ups into standalone questions | A bad rewrite only hurts retrieval, and the deterministic fallback is kept |
| Classifying intent (product question, out of scope, small talk) | Errors fall through to the normal grounded path |
| Extracting facts from documents at ingestion | The output is reviewed (conflicts) and checked by evals before it matters |
| Drafting eval questions and paraphrases | People approve which ones enter the eval set |
| First-pass grading of eval answers (LLM judge) | A human grades a sample to keep the judge honest |

### Use code, not models and not people

Retrieval scoring, key handling, fallback order, timeouts, cost arithmetic, input validation and citation verification. These must be deterministic, testable and identical on every run. A model should never decide whether its own answer is grounded.

### People must be involved

| Decision | Who | Why a model can't own it |
|---|---|---|
| **Which document is correct when two disagree** | The document owner (product or support lead) | The model can flag a conflict; only the business knows whether $49 or $59 is the current price for this customer |
| **What goes into the knowledge base**, and fixing the documents | Doc owners | The bot is only as accurate as its sources; "not in the KB" answers in the review queue show what is missing |
| **The golden eval set** and what counts as "correct" | Sales, Support and Training leads | Acceptance criteria belong to the people who use the answers |
| **Shipping prompt, model or retrieval changes** | The engineer, gated by eval results | Evals inform the decision; a person owns the trade-off (e.g. the Cohere precision-vs-recall trade-off in E4) |
| **Reviewing 👎 and unverified answers** | A rotating support or training owner | Turns failures into document fixes and new eval cases |
| **Commitments made to customers** | The employee on the call | The bot informs; it doesn't quote contracts. Pricing, SLA and compatibility answers should say "verify before committing" when a conflict or an unverified claim is involved |
| **Model and provider choice, price table, data retention** | Engineering with finance and security | Cost, privacy and vendor terms are business decisions; `config/models.json` prices are checked by hand |
| **Security reviews and incident response** | Engineering | Key handling, abuse and data exposure need accountable owners |
