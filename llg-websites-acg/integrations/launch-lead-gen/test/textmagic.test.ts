import { describe, expect, it } from "vitest";
import { getTextMagicMessageId, parseTextMagicCallback } from "../src/textmagic";

describe("TextMagic callbacks", () => {
  it("parses the configured multipart callback format", async () => {
    const form = new FormData();
    form.set("id", "message-123");
    form.set("sender", "+12105550199");
    form.set("receiver", "+18337689020");
    form.set("text", "I need a paver quote");
    const request = new Request("https://local.invalid", { method: "POST", body: form });
    const payload = await parseTextMagicCallback(await request.arrayBuffer(), request.headers.get("content-type") || "");
    expect(payload).toMatchObject({
      id: "message-123",
      sender: "+12105550199",
      receiver: "+18337689020",
      text: "I need a paver quote",
    });
  });

  it("also accepts JSON callbacks", async () => {
    const payload = await parseTextMagicCallback(
      new TextEncoder().encode(JSON.stringify({ id: "message-456", status: "delivered" })).buffer,
      "application/json",
    );
    expect(payload).toEqual({ id: "message-456", status: "delivered" });
  });

  it("extracts outbound message IDs from supported API response shapes", () => {
    expect(getTextMagicMessageId({ id: 12345 })).toBe("12345");
    expect(getTextMagicMessageId({ message: { id: "message-789" } })).toBe("message-789");
    expect(() => getTextMagicMessageId({ result: "queued" })).toThrow("textmagic_missing_message_id");
  });
});
