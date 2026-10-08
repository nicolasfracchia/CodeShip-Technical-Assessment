import { PRODUCTS, type Chunk, type DocType, type Product } from "./types";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Split one markdown document into heading-level chunks.
 * - Each `## ` section is one chunk, so a table always stays with its header row
 *   (a P1 row is never separated from the "Starter | Pro | Enterprise" header).
 * - Text before the first `##` (title, "updated" line, description) becomes an "Overview" chunk.
 * - Files are used as-is; nothing is rewritten.
 */
export function chunkMarkdown(file: string, markdown: string): Chunk[] {
  const base = file.replace(/\.md$/, "");
  const product = (PRODUCTS.find((p) => base.startsWith(p)) ?? null) as Product | null;
  const docType: DocType = base.endsWith("release-notes")
    ? "release-notes"
    : product
      ? "product"
      : "company";

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const titleLine = lines.find((l) => l.startsWith("# "));
  const docTitle = titleLine ? titleLine.slice(2).trim() : base;
  const updated = markdown.match(/updated (\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;

  const sections: { heading: string; body: string[] }[] = [{ heading: "Overview", body: [] }];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      sections.push({ heading: line.slice(3).trim(), body: [line] });
    } else {
      sections[sections.length - 1].body.push(line);
    }
  }

  const chunks: Chunk[] = [];
  for (const { heading, body } of sections) {
    const text = body.join("\n").trim();
    // Skip an overview that is only the title line (release-notes files).
    if (!text || (heading === "Overview" && text.split("\n").filter((l) => l.trim()).length <= 1)) {
      continue;
    }
    const versionMatch = docType === "release-notes" ? heading.match(/^(\d+\.\d+)/) : null;
    const releaseDate = heading.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] ?? null;
    chunks.push({
      id: `${file}#${slug(heading)}`,
      file,
      docTitle,
      section: heading,
      product,
      docType,
      date: docType === "release-notes" ? releaseDate : updated,
      version: versionMatch?.[1] ?? null,
      text,
    });
  }
  return chunks;
}
