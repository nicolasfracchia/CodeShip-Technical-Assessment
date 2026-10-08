# NimbusStack Knowledge Assistant

An internal chatbot that answers NimbusStack product questions **only from the supplied knowledge base**, with cited source passages, streaming answers, model switching across providers with automatic fallback, and per-message token and cost tracking.

- **Live demo:** _add the Vercel URL here_
- **Stack:** Next.js 16 (App Router) · TypeScript · Vercel AI SDK 7 · Tailwind 4 · Vitest
- **Knowledge base:** `nimbusstack-knowledge-base/` (used as-is, never edited)

---

## Run it locally

Requires **Node.js 22+** (the AI SDK 7 minimum).

```bash
git clone https://github.com/nicolasfracchia/CodeShip-Technical-Assessment.git
cd CodeShip-Technical-Assessment
npm install
cp .env.example .env.local      # then paste at least one API key (GROQ_API_KEY recommended)
npm run dev                     # http://localhost:3000
```

One key is enough. Every provider without a key is shown as *unavailable* in the dropdown and skipped by the fallback chain. All keys used here come from free tiers (links in `.env.example`).

| Command | What it does |
|---|---|
| `npm run dev` | Builds the KB index, starts the dev server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit tests: retrieval, chunking, fallback, E8, E9, cost, key exposure (offline, no keys needed) |
| `npm run eval` | Live end-to-end eval of Q1–Q6, E1–E6 and E10 against a running server (writes `eval-results.md`) |
| `npm run check:bundle` | After `npm run build`: fails if any API key value or key pattern is in the browser bundle |

`BASE_URL=https://<deployment> MODEL=gemini-flash-lite EVAL_DELAY_MS=20000 npm run eval` runs the eval against any deployment and model.

### Deploy to Vercel

Import the repo in the Vercel dashboard (framework: Next.js, no settings to change). Add the keys from `.env.example` as **Environment Variables**, then deploy. The KB index is generated at build time (`prebuild`), so the function never reads markdown at runtime.

---

## How it works

```
Browser ──POST /api/chat {messages, modelId}──► Next.js route (server only; keys live here)
                                                 1. validate: blank message → 400, no AI call (E10)
                                                 2. build retrieval query from conversation (E1)
                                                 3. BM25 + synonyms + product fan-out over KB chunks (R2)
                                                 4. grounded prompt: sources attached to the latest turn
                                                 5. provider chain from config/models.json (R3)
◄── NDJSON stream: sources │ start │ delta… │ reset │ done{usage, cost, model that answered} │ error
```

| Path | Role |
|---|---|
| `config/models.json` | **All** model data: names, descriptions, prices, context windows, default model, fallback order. Nothing is hard-coded. |
| `scripts/build-kb.ts` → `src/lib/kb/chunker.ts` | Splits each markdown file by `##` section and attaches metadata (product, doc type, date, release version) |
| `src/lib/kb/retrieval.ts` | BM25 with a domain synonym map, product scoping and fan-out, version boost |
| `src/lib/kb/context.ts` | Follow-up handling: carries the product and topic over from earlier turns |
| `src/lib/prompt.ts` | Grounding rules, source formatting, staleness hints, history trimming |
| `src/lib/llm/chat.ts` | Streaming with fallback, timeouts and `reset` events |
| `src/lib/llm/errors.ts` | Sorts provider errors into rate limit / auth / quota / unavailable / timeout, with user-facing messages |
| `src/app/page.tsx` | Chat UI |

### Key decisions

**Retrieval: BM25 with synonyms, not embeddings.** The KB is 10 files and 38 sections (about 5k tokens). Lexical search plus a domain synonym map (SSO ↔ SAML ↔ single sign-on ↔ federated login ↔ OIDC, 403 ↔ forbidden, SLA ↔ response time, …) is deterministic, unit-testable, free, and adds no API dependency or point of failure. With a much larger KB, I'd add embeddings and a reranker.

**Chunks are whole `##` sections.** A table is never separated from its header row, so "P1 for Pro" always comes from the right row and column (E6). Each chunk carries its product, doc type, document date and release version.

**Completeness for cross-product questions.** If a question names no product ("which of our products…"), retrieval takes the best sections *per product* plus the company-wide docs, so Q5 and Q6 always see all four products.

**Follow-ups (E1) are deterministic.** If the latest message names no product, the products from the most recent earlier question carry over. Short or pronoun questions ("what about its SLA?") also get the previous question's text added. This avoids an extra LLM call (latency, cost, another point of failure) and is covered by unit tests.

**Grounding (the one rule).** Sources are attached to the latest user turn, labelled `[S1]…[Sn]` with file, section, doc type and date. The system prompt requires: facts only from sources, a citation on every claim, an exact "not in the knowledge base" sentence (E2), explicit "Not in the knowledge base:" lines for partial answers (E3), "⚠️ Sources disagree" with both citations and dates (E4), exact row and column reads for tables (E6), and every product covered for cross-product questions. Temperature 0. Every answer shows its source passages in the UI.

**Conflict detection (E4).** On top of the prompt rule, any company-wide summary that is *older* than product docs or release notes in the same source set gets a note in its header asking the model to compare them. This is purely date-based, not hard-coded to the known conflicts. It was added because one model (gpt-oss) missed the Vault SAML conflict without it.

**Per-question reminders.** Instructions near the question get more weight than rules deep in the system prompt. For integration questions only, a one-line reminder after the question asks for both the product version and the partner requirement. Without it, gpt-oss answered Q2 with "Vault 3.1" and dropped "Salesforce API v58".

**Reasoning effort is measured, not guessed.** Groq gpt-oss runs at `reasoningEffort: medium`. At `low`, the eval dropped from 18/19 to 16/19, and every new failure was a missed document conflict.

**Fallback (R3, R5, E8, E9).** The chain is the selected model first, then `fallbackOrder`, skipping models with no key or that are disabled. Each step of the stream races a timer (20 s to first token, 20 s idle), so a hung provider can't stall the chain. If a provider fails *after* it started streaming, the server sends `reset`, the client discards the partial text, and the backup starts clean: the user never sees two models mixed. The final `done` event names the model that actually answered, and the UI says when the backup was used. If everything fails, the user gets an actionable message ("rate-limited, wait about N seconds"), never a stack trace.

**Usage (R4).** Token counts come from the provider's own usage report. Cost = tokens × the config's list price (USD per 1M tokens). All models here run on free tiers, so the real charge is $0; the app shows what the same usage would cost at paid list prices. Session totals update after each message, and usage exports as CSV or JSON. The context meter shows (last input + last output tokens) ÷ the **selected** model's window, turns amber at 75% and red at 90%, and recalculates the moment the model changes (E7). The server also trims the oldest turns to fit small windows (Cloudflare Llama: 24K).

**Default model: Groq GPT-OSS 120B.** Measured, not assumed: Gemini 3.5 Flash's free tier is **20 requests/day** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier: 20`), which testers would use up quickly. Groq gives 1,000 requests/day and 8K tokens/min with about 1–2 s answers. The Gemini models are next in the fallback chain.

### Providers

| Dropdown entry | Provider | Status |
|---|---|---|
| GPT-OSS 120B | Groq | Live, **default** |
| Gemini 3.1 Flash-Lite / Gemini 3.5 Flash | Google AI Studio | Live (3.5 Flash: 20 requests/day on the free tier) |
| Llama 3.3 70B | Cloudflare Workers AI | Live, 24K context: the easiest way to see the context warning |
| Nemotron 3 Super | OpenRouter (free pool) | Live, shared rate limits |
| Command A | Cohere | Live, trial key |
| GLM-4.5 Flash | Z.ai | Live, slower reasoning model |
| Claude Sonnet 5.5 | Anthropic | **Placeholder**: set `ANTHROPIC_API_KEY` to enable (uses Anthropic's OpenAI-compatible endpoint) |
| GPT-5.4 mini | OpenAI | **Placeholder**: set `OPENAI_API_KEY` to enable |
| Llama 3.3 70B | SambaNova | Disabled in config (account requires a payment method) |

Adding a provider means adding a config entry: any OpenAI-compatible API needs only `baseURL` and `apiKeyEnv`.

### Things the knowledge base gets wrong or leaves ambiguous

The documents were used as-is. These are the places the bot has to handle carefully, and the eval checks them:

1. **Vault SSO tiers disagree.** The security overview (2026-01-15) says SAML is Enterprise only; `vault.md` (2026-07-03) and the 3.1 release notes (2026-04-14) say Pro and Enterprise.
2. **Relay Pro price.** `relay.md` says $49. The 4.2 release notes say $59 for contracts signed on or after 1 Aug 2026.
3. **Pulse has no SAML** (OIDC only; SAML is on the roadmap). For "which products support SAML", that's a "no", not an omission.
4. **"v4.2"** exists only for Relay. Pulse has 4.1 and 4.3. Vault (3.x) and Ledger (2.x) don't use 4.x versions.
5. **403 troubleshooting** exists for Relay and Pulse only, with different steps.
6. **Salesforce.** Pulse needs ≥4.3 and API v59; Vault needs ≥3.1 and API v58; Relay is *not supported* (a community Zapier bridge exists); for Ledger, the product page says "coming soon in the 2.6 roadmap" while the release notes say "planned for a later release".
7. **SLA tables** differ by product *and* tier, and Pulse's tiers are named Growth/Pro/Enterprise.

### Not built, and why

The brief doesn't require these: login, prompt caching (the KB is tiny), persisted chats, a KB editor, analytics. Conversation state lives in the browser tab. "New Conversation" clears it.

### Build timeline

See [`BUILD_LOG.md`](BUILD_LOG.md). The git tag **`first-hour`** marks the exact state at the 60-minute mark. `git diff first-hour..HEAD` shows everything built afterwards.
