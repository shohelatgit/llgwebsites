import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestCallRailSmsEvent } from "../src/supabase";
import type { RuntimeEnv } from "../src/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CallRail SMS ingestion", () => {
  it("posts normalized webhook data to the protected Supabase RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accepted: true,
      matched: true,
      property_id: 86,
      lead_id: 445,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
      SUPABASE_INGEST_TOKEN: "private-ingest-token",
    } as unknown as RuntimeEnv;
    const payload = {
      resource_id: "SCI-test",
      source_number: "+15085550199",
      destination_number: "+12107968693",
      content: "Need a paver quote",
      timestamp: "2026-08-05T15:00:00-04:00",
    };

    await expect(ingestCallRailSmsEvent(env, "text_received", payload, "request-1"))
      .resolves.toMatchObject({ accepted: true, property_id: 86 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/rest/v1/rpc/ingest_callrail_sms_event");
    expect(JSON.parse(String(init.body))).toEqual({
      p_event_type: "text_received",
      p_payload: payload,
      p_request_id: "request-1",
      p_ingest_token: "private-ingest-token",
    });
  });
});
