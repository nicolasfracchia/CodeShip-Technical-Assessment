import { describe, expect, it } from "vitest";
import { prepareMarkdown } from "@/lib/ui/citations";

describe("citation normalization", () => {
  it("turns every model's citation style into a chip", () => {
    expect(prepareMarkdown("a [S1] b")).toBe("a `S1` b");
    expect(prepareMarkdown("a 【S2】 b")).toBe("a `S2` b");
    expect(prepareMarkdown("a [​S7] b")).toBe("a `S7` b"); // zero-width space (gpt-oss)
    expect(prepareMarkdown("a [ S3 ] b")).toBe("a `S3` b");
  });

  it("leaves markdown links and tables alone", () => {
    expect(prepareMarkdown("[docs](https://x.y) | a | b |")).toBe("[docs](https://x.y) | a | b |");
  });
});
