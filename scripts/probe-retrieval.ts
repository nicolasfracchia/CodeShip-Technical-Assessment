/** Prints what retrieval returns for a conversation, without calling any model. Usage: npm run probe -- "question" ["answer" "follow-up" ...] */
import { retrieveForConversation } from "../src/lib/kb/index";
const qs = process.argv.slice(2);
const msgs = qs.map((q, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", content: q }));
const r = retrieveForConversation(msgs);
console.log(`products=${r.products.join(",") || "(all)"} carried=${r.carriedOver}`);
for (const s of r.sources) console.log(`  ${s.label} ${s.score.toFixed(2).padStart(6)} ${s.id}`);
