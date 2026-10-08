import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }));

describe("/api/chat validation (E10)", () => {
  it("rejects a blank message with 400 before any provider is called", async () => {
    const res = await post({ modelId: "groq-gpt-oss", messages: [{ role: "user", content: "   \n\t " }] });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ type: "error", code: "empty_message" });
  });

  it("rejects a blank follow-up even when earlier turns are valid", async () => {
    const res = await post({
      modelId: "groq-gpt-oss",
      messages: [
        { role: "user", content: "Does Vault integrate with Salesforce?" },
        { role: "assistant", content: "Yes [S1]." },
        { role: "user", content: "" },
      ],
    });
    expect(res.status).toBe(400);
  });

  it("rejects unknown models and malformed bodies", async () => {
    expect((await post({ modelId: "nope", messages: [{ role: "user", content: "hi" }] })).status).toBe(400);
    expect((await post({ messages: "hi" })).status).toBe(400);
  });
});
