/**
 * Security check: after `npm run build`, make sure no API key ends up in anything
 * served to the browser (.next/static). Checks the real values from the environment
 * (.env.local or process env) plus common key patterns.  Exit code 1 on any hit.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import config from "../config/models.json";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const envNames = new Set<string>(Object.values(config.providers).map((p) => p.apiKeyEnv));
envNames.add("CLOUDFLARE_ACCOUNT_ID");
const secrets = [...envNames].map((n) => [n, process.env[n]] as const).filter(([, v]) => v && v.length >= 8);

const PATTERNS = [/AIza[0-9A-Za-z_-]{30,}/, /sk-or-v1-[0-9a-f]{20,}/, /gsk_[0-9A-Za-z]{20,}/, /sk-ant-[0-9A-Za-z_-]{20,}/, /sk-proj-[0-9A-Za-z_-]{20,}/];

const root = join(".next", "static");
if (!existsSync(root)) {
  console.error("No .next/static found. Run `npm run build` first.");
  process.exit(2);
}

function* walk(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let files = 0;
const hits: string[] = [];
for (const file of walk(root)) {
  files++;
  const content = readFileSync(file, "utf8");
  for (const [name, value] of secrets) if (content.includes(value!)) hits.push(`${file}: contains the value of ${name}`);
  for (const re of PATTERNS) if (re.test(content)) hits.push(`${file}: matches key pattern ${re}`);
  for (const name of envNames) if (content.includes(name)) hits.push(`${file}: mentions env var ${name}`);
}

console.log(`Scanned ${files} browser files against ${secrets.length} configured secrets and ${PATTERNS.length} key patterns.`);
if (hits.length) {
  console.error("FAIL: possible secret exposure:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("PASS: no API keys in the client bundle.");
