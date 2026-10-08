# NimbusStack Knowledge Assistant

An internal chatbot that answers questions about NimbusStack's four products **only from the supplied knowledge base**. Every answer cites its source passages and flags documents that disagree. If the knowledge base doesn't cover a question, the bot says so instead of guessing. You can switch AI providers at any time, a backup provider takes over automatically if one fails, and each answer shows its token count and cost.

- **Live demo:** https://codeship-technical-assessment.vercel.app
- **Stack:** Next.js 16 · TypeScript · Vercel AI SDK 7 · Tailwind 4 · Vitest

## Run it locally

Requires **Node.js 22+**.

```bash
git clone https://github.com/nicolasfracchia/CodeShip-Technical-Assessment.git
cd CodeShip-Technical-Assessment
npm install
cp .env.example .env.local      # add at least one API key (GROQ_API_KEY recommended, free)
npm run dev                     # http://localhost:3000
```

One key is enough. Providers without a key show as *unavailable* in the dropdown and are skipped by the fallback. Free-tier key links are in `.env.example`.

| Command | What it does |
|---|---|
| `npm run dev` | Builds the knowledge-base index and starts the dev server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Offline unit tests (no keys needed) |
| `npm run typecheck` | TypeScript check |
| `npm run eval` | Live end-to-end eval of the brief's questions and edge cases against a running server; writes `docs/eval-results.md` |
| `npm run ask -- <modelId> "question"` | Ask the running server one question from the terminal |
| `npm run probe -- "question"` | Show which passages retrieval picks, without calling a model |
| `npm run check:bundle` | After a build: fails if any API key is in the browser bundle |

## Project layout

```
config/models.json             every model, price, context window and the fallback order
nimbusstack-knowledge-base/    the client's documents, used as-is
src/app/                       chat page and the /api/chat and /api/models routes
src/components/chat/           message bubbles and the context meter
src/lib/kb/                    chunking, retrieval, follow-up handling
src/lib/llm/                   providers, fallback chain, error handling, cost
src/lib/prompt.ts              grounding rules and source formatting
scripts/                       KB build, eval, CLI tools, bundle key scan
tests/                         unit tests
docs/                          documentation (below)
```

`AGENTS.md` stays in the root because `next dev` regenerates it there.

## Documentation

- **[Architecture and key decisions](docs/architecture.md)**: the request flow, a map of the code, and why each main choice was made (BM25 retrieval, section chunks, grounding rules, conflict handling, fallback, usage tracking, default model). It also lists the providers and the places where the knowledge base contradicts itself.
- **[Deficiencies and next steps](docs/deficiencies-and-next-steps.md)**: an honest review of what is weak and why, how to fix each issue, the stages every question should go through to get the best answer, and where to rely on models versus where people must decide.
- **[Comparison with the RTDRS Hearing Assistant](docs/comparison-with-rtdrs.md)**: what this project shares with my earlier RTDRS project, and which of its deficiencies RTDRS already solves (hybrid retrieval, ingestion, structured output, access control, logging, CI).
- **[Deploying to Vercel](docs/deployment.md)**: the three deployment steps, how to verify a deployment, and fixes for the two errors seen in practice.
- **[Build log](docs/build-log.md)**: a timestamped record of the build. The git tag `first-hour` marks the state at the 60-minute mark; `git diff first-hour..HEAD` shows everything built afterwards.
- **[Eval results](docs/eval-results.md)**: the latest full output of `npm run eval`, with every question and answer and its pass or fail.
- **[Assessment brief](docs/assessment-brief.md)**: the original CodeShip brief this project answers, with requirements R1–R5 and edge cases E1–E10.
