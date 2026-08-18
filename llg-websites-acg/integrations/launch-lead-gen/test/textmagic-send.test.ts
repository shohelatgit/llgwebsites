import { afterEach, describe, expect, it, vi } from "vitest";
import { getTextMagicMessageId, sendTextMagicMessage } from "../src/textmagic";

afterEach(() => vi.unstubAllGlobals());

describe("TextMagic outbound adapter", () => {
  it("sends through the V2 endpoint with server-side credentials and sender", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        "X-TM-Username": "effectlocal",
        "X-TM-Key": "secret-key",
      });
      expect(String(init?.body)).toContain("phones=%2B15125550199");
      expect(String(init?.body)).toContain("from=%2B18337689020");
      return new Response(JSON.stringify({ id: 731 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendTextMagicMessage({
      TEXTMAGIC_USERNAME: "effectlocal",
      TEXTMAGIC_API_KEY: "secret-key",
      TEXTMAGIC_DEFAULT_FROM: "+18337689020",
    } as never, "+15125550199", "Welcome");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://rest.textmagic.com/api/v2/messages");
    expect(getTextMagicMessageId(result)).toBe("731");
  });
});
