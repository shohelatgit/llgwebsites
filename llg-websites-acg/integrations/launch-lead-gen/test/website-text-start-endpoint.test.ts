import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }));
import worker from "../src/index";

afterEach(() => vi.unstubAllGlobals());

describe("website text-start endpoint", () => {
  it("records the lead, starts the flow, and sends the personalized first TextMagic message", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("challenges.cloudflare.com")) {
        return Response.json({ success: true, action: "lead_submit" });
      }
      if (url.endsWith("/rest/v1/rpc/ingest_provider_event")) {
        const body = JSON.parse(String(init?.body));
        expect(body.p_event.conversion_channel).toBe("sms");
        return Response.json({ accepted: true, duplicate: false, lead_id: 44, lead_public_id: "lead-public-44" });
      }
      if (url.endsWith("/rest/v1/rpc/record_website_attribution_touches")) {
        return Response.json({ recorded: true });
      }
      if (url.endsWith("/rest/v1/rpc/start_sms_qualification")) {
        return Response.json({
          should_send: true,
          session_id: 10,
          property_id: 86,
          lead_id: 44,
          to_phone: "+15125550199",
          from_phone: "+18337689020",
          message: "What type of drainage issue are you seeing?",
          status: "active",
          step: 0,
        });
      }
      if (url === "https://rest.textmagic.com/api/v2/messages") {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("phones")).toBe("+15125550199");
        expect(body.get("text")).toContain("Hi Jane, thanks for reaching out about Yard Drainage.");
        return Response.json({ id: 731 });
      }
      if (url.endsWith("/rest/v1/rpc/record_textmagic_outbound")) {
        return Response.json({ recorded: true, sms_message_id: 31 });
      }
      return Response.json({ error: "unexpected_test_request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.test/v1/website-text-starts", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({
        submissionId: "widget-1",
        siteKey: "austin-drain-guys",
        businessName: "Austin Drain Guys",
        fullName: "Jane Doe",
        phone: "(512) 555-0199",
        zip: "78701",
        service: "Yard Drainage",
        message: "Water collects beside the foundation.",
        smsConsent: true,
        consentText: "I agree to receive automated service-related text messages. Reply STOP to opt out.",
        consentVersion: "website-text-widget-v1",
        turnstileToken: "test-token",
        firstTouch: { utm_source: "google" },
        lastTouch: { utm_source: "google", gclid: "click-123" },
      }),
    });
    const response = await worker.fetch(request, {
      WEBSITE_PRODUCTION_ORIGINS_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-secret",
      TURNSTILE_EXPECTED_ACTION: "lead_submit",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_INGEST_TOKEN: "ingest-token",
      TEXTMAGIC_USERNAME: "effectlocal",
      TEXTMAGIC_API_KEY: "secret-key",
      TEXTMAGIC_DEFAULT_FROM: "+18337689020",
      TEXTMAGIC_DELIVERY_ENABLED: "true",
    } as never);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ok: true, smsStarted: true, leadId: "lead-public-44" });
    expect(calls).toHaveLength(6);
  });

  it("continues an inbound TextMagic qualification reply automatically", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/rest/v1/rpc/ingest_textmagic_event")) {
        return Response.json({ accepted: true, external_message_id: "tm-in-1", property_id: 86, lead_id: 44 });
      }
      if (url.endsWith("/rest/v1/rpc/prepare_sms_qualification_reply")) {
        return Response.json({
          should_send: true,
          session_id: 10,
          property_id: 86,
          lead_id: 44,
          to_phone: "+15125550199",
          from_phone: "+18337689020",
          message: "When would you like the work completed?",
          status: "active",
          step: 1,
        });
      }
      if (url === "https://rest.textmagic.com/api/v2/messages") {
        expect(new URLSearchParams(String(init?.body)).get("text")).toBe("When would you like the work completed?");
        return Response.json({ id: 900 });
      }
      if (url.endsWith("/rest/v1/rpc/record_textmagic_outbound")) {
        return Response.json({ recorded: true });
      }
      return Response.json({ error: "unexpected_test_request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(new Request("https://worker.test/webhooks/textmagic/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer webhook-secret" },
      body: JSON.stringify({ id: "tm-in-1", sender: "+15125550199", receiver: "+18337689020", text: "This month" }),
    }), {
      TEXTMAGIC_WEBHOOK_TOKEN: "webhook-secret",
      TEXTMAGIC_DELIVERY_ENABLED: "true",
      TEXTMAGIC_USERNAME: "effectlocal",
      TEXTMAGIC_API_KEY: "secret-key",
      TEXTMAGIC_DEFAULT_FROM: "+18337689020",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_INGEST_TOKEN: "ingest-token",
    } as never);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ok: true, replySent: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
