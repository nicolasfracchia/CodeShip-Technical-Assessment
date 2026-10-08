import { describe, expect, it } from "vitest";
import { retrieveForConversation } from "@/lib/kb";
import { buildRetrievalQuery } from "@/lib/kb/context";
import { retriever } from "@/lib/kb";

const ids = (q: string) => retrieveForConversation([{ role: "user", content: q }]).sources.map((s) => s.id);

describe("chunking", () => {
  it("keeps every SLA table whole with its header row (E6)", () => {
    const slas = retriever.chunks.filter((c) => c.section === "Support SLA");
    expect(slas).toHaveLength(4);
    for (const c of slas) {
      expect(c.text).toMatch(/\| Priority \|/);
      expect(c.text).toMatch(/P1 \(service down\)/);
      expect(c.text).toMatch(/P4 \(feature request\)/);
    }
  });

  it("tags release-note sections with their version and date", () => {
    const relay42 = retriever.chunks.find((c) => c.id === "relay-release-notes.md#4.2-2026-06-10");
    expect(relay42?.version).toBe("4.2");
    expect(relay42?.date).toBe("2026-06-10");
  });
});

describe("retrieval for the representative questions", () => {
  it("Q1 pricing: all four pricing tables plus the Relay 4.2 price change", () => {
    const r = ids("What are the key differences between the Pro and Enterprise pricing tiers?");
    for (const p of ["relay", "vault", "pulse", "ledger"]) expect(r).toContain(`${p}.md#pricing`);
    expect(r).toContain("relay-release-notes.md#4.2-2026-06-10");
  });

  it("Q2 Salesforce for a named product: that product's integrations table", () => {
    const r = ids("Does Vault integrate with Salesforce? What version is required?");
    expect(r[0]).toBe("vault.md#integrations");
    expect(r.every((id) => id.startsWith("vault") || !/^(relay|pulse|ledger)/.test(id))).toBe(true);
  });

  it("Q3 v4.2: Relay's 4.2 notes; for Pulse (no 4.2) returns its 4.1 and 4.3 notes", () => {
    expect(ids("What new features were released in v4.2 of Relay?")[0]).toBe("relay-release-notes.md#4.2-2026-06-10");
    const pulse = ids("What new features were released in v4.2 of Pulse?");
    expect(pulse).toContain("pulse-release-notes.md#4.1-2026-02-11");
    expect(pulse).toContain("pulse-release-notes.md#4.3-2026-08-20");
  });

  it("Q4 403: both troubleshooting sections", () => {
    const r = ids("A client is getting a 403 on the API. What should they check first?");
    expect(r.slice(0, 2).sort()).toEqual(["pulse.md#troubleshooting", "relay.md#troubleshooting"]);
  });

  it("Q5 SAML: identity evidence for every product + the company overview (complete answer)", () => {
    const r = ids("Which of our products support SSO via SAML 2.0?");
    expect(r).toContain("security-overview.md#identity");
    expect(r).toContain("pulse.md#access-and-sign-in");
    expect(r.some((id) => id.startsWith("relay.md"))).toBe(true);
    expect(r.some((id) => id.startsWith("vault"))).toBe(true);
    expect(r.some((id) => id.startsWith("ledger.md"))).toBe(true);
    expect(r).not.toContain("relay.md#support-sla"); // "support SSO" is not an SLA question
  });

  it("Q6 P1 SLA: all four SLA tables and the priority definitions", () => {
    const r = ids("What's the SLA for Priority 1 support tickets?");
    for (const p of ["relay", "vault", "pulse", "ledger"]) expect(r).toContain(`${p}.md#support-sla`);
    expect(r).toContain("support-policy.md#priority-definitions");
  });

  it("E5 loose wording 'single sign-on' finds SAML/SSO passages", () => {
    const r = ids("does it do single sign-on?");
    expect(r).toContain("security-overview.md#identity");
  });

  it("E2 off-topic question retrieves nothing", () => {
    expect(ids("What is the capital of France?")).toEqual([]);
  });
});

describe("conversation context (E1)", () => {
  it("carries the product into a pronoun follow-up", () => {
    const q = buildRetrievalQuery([
      { role: "user", content: "Does Vault integrate with Salesforce?" },
      { role: "assistant", content: "Yes, since Vault 3.1." },
      { role: "user", content: "what about its SLA?" },
    ]);
    expect(q.products).toEqual(["vault"]);
    const r = retrieveForConversation([
      { role: "user", content: "Does Vault integrate with Salesforce?" },
      { role: "assistant", content: "Yes, since Vault 3.1." },
      { role: "user", content: "what about its SLA?" },
    ]).sources.map((s) => s.id);
    expect(r[0]).toBe("vault.md#support-sla");
    expect(r.some((id) => id.startsWith("relay") || id.startsWith("pulse") || id.startsWith("ledger"))).toBe(false);
  });

  it("an explicitly named new product wins over the carried one", () => {
    const q = buildRetrievalQuery([
      { role: "user", content: "Tell me about Vault pricing" },
      { role: "assistant", content: "..." },
      { role: "user", content: "And what does Pulse cost?" },
    ]);
    expect(q.products).toEqual(["pulse"]);
  });
});
