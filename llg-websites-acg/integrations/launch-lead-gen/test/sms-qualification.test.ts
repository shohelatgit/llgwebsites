import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareSmsQualificationReply, recordTextMagicOutbound, startSmsQualification } from "../src/supabase";

const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_INGEST_TOKEN: "ingest-token",
} as never;

afterEach(() => vi.unstubAllGlobals());

describe("SMS qualification RPC adapters", () => {
  it("prepares a provider-neutral reply for an inbound CallRail text", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        p_source_provider_key: "callrail",
        p_external_message_id: "sms-123",
        p_ingest_token: "ingest-token",
      });
      return new Response(JSON.stringify({
        should_send: true,
        session_id: 9,
        property_id: 86,
        lead_id: 445,
        to_phone: "+15084154385",
        from_phone: "+18337689020",
        message: "What type of project do you need help with?",
        status: "active",
        step: 0,
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const reply = await prepareSmsQualificationReply(env, "callrail", "sms-123");
    expect(reply).toMatchObject({ shouldSend: true, sessionId: 9, propertyId: 86, leadId: 445 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://project.supabase.co/rest/v1/rpc/prepare_sms_qualification_reply");
  });

  it("starts and records a TextMagic qualification conversation", async () => {
    const responses = [
      new Response(JSON.stringify({
        should_send: true,
        session_id: 10,
        property_id: 86,
        lead_id: 445,
        to_phone: "+15084154385",
        from_phone: "+18337689020",
        message: "Welcome. What type of project?",
        status: "active",
        step: 0,
      })),
      new Response(JSON.stringify({ recorded: true, sms_message_id: 31 })),
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() as Response);
    vi.stubGlobal("fetch", fetchMock);

    const reply = await startSmsQualification(
      env,
      "domain:3vsanantoniopaverservices.com",
      "+15084154385",
      445,
    );
    await recordTextMagicOutbound(env, "tm-31", reply, { id: "tm-31" });

    expect(reply.sessionId).toBe(10);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://project.supabase.co/rest/v1/rpc/start_sms_qualification");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://project.supabase.co/rest/v1/rpc/record_textmagic_outbound");
  });
});
