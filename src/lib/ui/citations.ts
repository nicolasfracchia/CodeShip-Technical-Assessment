/**
 * Normalizes the citation styles different models emit, then turns [S2] into inline code
 * (rendered as a citation chip). Handles 【S2】 (gpt-oss), zero-width characters inside
 * brackets ([​S7]), and stray spaces ([ S3 ]).
 */
export function prepareMarkdown(text: string): string {
  return text
    .replace(/[​‌‍⁠﻿]/g, "")
    .replace(/【\s*(S\d+)\s*】/g, "[$1]")
    .replace(/\[\s*(S\d+)\s*\]/g, "`$1`");
}
