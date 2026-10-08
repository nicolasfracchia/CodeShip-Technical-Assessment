/**
 * Builds src/generated/kb.json from the untouched markdown files in
 * nimbusstack-knowledge-base/. Runs before dev, build and test, so the
 * deployed serverless function never reads the filesystem at runtime.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunkMarkdown } from "../src/lib/kb/chunker";
import type { KnowledgeBase } from "../src/lib/kb/types";

const KB_DIR = join(process.cwd(), "nimbusstack-knowledge-base");
const OUT_DIR = join(process.cwd(), "src", "generated");

const files = readdirSync(KB_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

const kb: KnowledgeBase = {
  builtAt: new Date().toISOString(),
  chunks: files.flatMap((f) => chunkMarkdown(f, readFileSync(join(KB_DIR, f), "utf8"))),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "kb.json"), JSON.stringify(kb, null, 2));
console.log(`KB: ${files.length} files -> ${kb.chunks.length} chunks`);
