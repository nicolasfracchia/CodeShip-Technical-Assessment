/**
 * End-to-end eval against a running server (local or deployed).
 *   npm run eval                                  # default model, http://localhost:3000
 *   BASE_URL=https://your-app.vercel.app MODEL=groq-gpt-oss EVAL_DELAY_MS=8000 npm run eval
 * Each case checks the answer text with regexes; full answers go to eval-results.md.
 */
import { writeFileSync } from "node:fs";
import { ask } from "./ask";

const MODEL = process.env.MODEL ?? "groq-gpt-oss";
/** Pause between requests so free-tier per-minute limits don't turn the eval into a fallback test. */
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 6000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const NOT_IN_KB = /couldn't find (this|that|it)? ?in the NimbusStack knowledge base|not in the knowledge base/i;

interface Case {
  id: string;
  turns: string[];
  must: RegExp[];
  mustNot?: RegExp[];
  note: string;
}

const CASES: Case[] = [
  { id: "Q1", note: "Pro vs Enterprise across products, incl. Relay $59 change (T2)", turns: ["What are the key differences between the Pro and Enterprise pricing tiers?"], must: [/\$49/, /\$59/, /\$35/, /\$199/, /\$299/, /custom/i] },
  { id: "Q2-vault", note: "Vault Salesforce version", turns: ["Does Vault integrate with Salesforce? What version is required?"], must: [/3\.1/, /v58/i] },
  { id: "Q2-pulse", note: "Pulse Salesforce version", turns: ["Does Pulse integrate with Salesforce? What version is required?"], must: [/4\.3/, /v59/i] },
  { id: "Q2-relay", note: "Relay: not supported (T6)", turns: ["Does Relay integrate with Salesforce? What version is required?"], must: [/not supported|does not support|doesn't support|no\b/i], mustNot: [/requires? (Relay )?(version )?4\.\d/i] },
  { id: "Q2-ledger", note: "Ledger: roadmap only (T6)", turns: ["Does Ledger integrate with Salesforce? What version is required?"], must: [/coming soon|roadmap|planned|not yet/i] },
  { id: "Q3-relay", note: "Relay 4.2 release notes", turns: ["What new features were released in v4.2 of Relay?"], must: [/replay/i, /EU|Frankfurt/i] },
  { id: "Q3-pulse", note: "No Pulse 4.2 exists (T4)", turns: ["What new features were released in v4.2 of Pulse?"], must: [/4\.1|4\.3/, /no (release notes|information|v?4\.2)|not (in|contain|include|list|have)|doesn't|does not|couldn't/i], mustNot: [/^Pulse 4\.2 (added|introduced)/im] },
  { id: "Q4", note: "403: Relay + Pulse steps (T5)", turns: ["A client is getting a 403 on the API. What should they check first?"], must: [/scope/i, /workspace/i] },
  { id: "Q5", note: "SAML: all four products, Pulse no, Vault conflict (T1, T3)", turns: ["Which of our products support SSO via SAML 2.0?"], must: [/Relay/, /Vault/, /Ledger/, /Pulse/, /disagree|conflict/i] }, // OIDC mention for Pulse is nice-to-have, not required by the brief
  { id: "Q6", note: "P1 SLA per product and tier (T7)", turns: ["What's the SLA for Priority 1 support tickets?"], must: [/15 minutes/, /30 minutes/, /1 hour/, /4 hours/, /8 business hours/] },
  { id: "E1", note: "Follow-up resolves to Vault SLA", turns: ["Does Vault integrate with Salesforce?", "What about its SLA?"], must: [/4 business hours/, /30 minutes/], mustNot: [/15 minutes/] },
  { id: "E2-refund", note: "Not in KB", turns: ["What is NimbusStack's refund policy for annual plans?"], must: [NOT_IN_KB] },
  { id: "E2-offtopic", note: "Off-topic", turns: ["What is the capital of France?"], must: [NOT_IN_KB], mustNot: [/Paris/] },
  { id: "E3", note: "Partial answer", turns: ["What does Vault Pro cost per seat, and is Vault SOC 2 certified?"], must: [/\$35/, /not in the knowledge base|not (mentioned|covered|documented)|doesn't (mention|cover)|does not (mention|cover)/i] },
  { id: "E4", note: "Conflict surfaced (Vault SAML tiers)", turns: ["Does Vault Pro support SAML single sign-on?"], must: [/disagree|conflict/i, /2026-01-15|security overview/i] },
  { id: "E4-none", note: "No false conflict on a plain SLA lookup", turns: ["What is the P2 SLA for Relay Pro?"], must: [/8 hours/], mustNot: [/disagree|conflict/i] },
  { id: "E5", note: "Loose wording finds SAML", turns: ["does ledger do single sign-on?"], must: [/SAML/i] },
  { id: "E6-a", note: "Exact table cell", turns: ["What is the P2 response time for Vault Pro?"], must: [/4 hours/], mustNot: [/\b2 hours\b/] },
  { id: "E6-b", note: "Exact table cell", turns: ["What is the P3 SLA for Relay Enterprise customers?"], must: [/8 hours/], mustNot: [/1 business day/] },
];

async function main() {
  const report: string[] = [`# Eval results\n\nModel: \`${MODEL}\` · Base: ${process.env.BASE_URL ?? "http://localhost:3000"} · ${new Date().toISOString()}\n`];
  let pass = 0;

  // E10: blank message must be rejected with 400 and no provider call.
  const blank = await ask(MODEL, [{ role: "user", content: "   " }]);
  const e10 = blank.status === 400;
  console.log(`${e10 ? "PASS" : "FAIL"} E10 blank message -> HTTP ${blank.status}`);
  report.push(`## E10 blank message: ${e10 ? "PASS" : "FAIL"} (HTTP ${blank.status})\n`);
  if (e10) pass++;

  const only = process.env.EVAL_ONLY; // e.g. EVAL_ONLY=Q2 runs only cases whose id starts with Q2
  const cases = only ? CASES.filter((c) => c.id.startsWith(only)) : CASES;
  for (const c of cases) {
    const msgs: { role: "user" | "assistant"; content: string }[] = [];
    let r: Awaited<ReturnType<typeof ask>> | undefined;
    for (const t of c.turns) {
      msgs.push({ role: "user", content: t });
      r = await ask(MODEL, msgs);
      await sleep(DELAY_MS);
      msgs.push({ role: "assistant", content: r.text });
    }
    // Models emit typographic spaces/hyphens (U+202F, U+00A0, U+2011); normalize before matching.
    const text = r!.text.replace(/[\u00a0\u202f\u2009\u2007]/g, " ").replace(/[\u2010\u2011\u2012\u2013]/g, "-");
    const missing = c.must.filter((re) => !re.test(text)).map(String);
    const forbidden = (c.mustNot ?? []).filter((re) => re.test(text)).map(String);
    const ok = text.length > 0 && missing.length === 0 && forbidden.length === 0;
    if (ok) pass++;
    const by = r!.done?.modelId ?? "none";
    console.log(`${ok ? "PASS" : "FAIL"} ${c.id.padEnd(12)} by=${by.padEnd(20)} ${missing.length ? "missing " + missing.join(" ") : ""} ${forbidden.length ? "forbidden " + forbidden.join(" ") : ""}`);
    report.push(
      `## ${c.id}: ${ok ? "PASS" : "FAIL"} (${c.note})\n\n` +
        c.turns.map((t) => `> ${t}`).join("\n>\n") +
        `\n\nAnswered by \`${by}\`${missing.length ? ` · missing: ${missing.join(", ")}` : ""}${forbidden.length ? ` · forbidden: ${forbidden.join(", ")}` : ""}\n\n${text || JSON.stringify(r!.error)}\n`,
    );
  }
  const total = cases.length + 1;
  console.log(`\n${pass}/${total} passed`);
  report.push(`\n**${pass}/${total} passed**\n`);
  writeFileSync("eval-results.md", report.join("\n"));
  process.exit(pass === total ? 0 : 1);
}

main();
