import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecentCallRailVoiceContext, recordCallRailPreCallContext } from "../src/supabase";
import type { RuntimeEnv } from "../src/types";

const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable",
  BLAND_INGEST_TOKEN: "ingest-token",
} as unknown as RuntimeEnv;

describe("CallRail pre-call voice context", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records the signed pre-call payload through the protected RPC", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      accepted: true,
      matched: true,
      property_id: 86,
    }), { status: 200 }));

    await expect(recordCallRailPreCallContext(env, {
      customer_phone_number: "+12105550199",
      tracking_phone_number: "+12107968693",
    }, "request-1")).resolves.toMatchObject({ matched: true, property_id: 86 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/ingest_callrail_precall_context",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("looks up the latest unambiguous property using the Bland caller number", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      matched: true,
      property_key: "domain:3vsanantoniopaverservices.com",
    }), { status: 200 }));

    await expect(getRecentCallRailVoiceContext(env, "+12105550199")).resolves.toMatchObject({
      matched: true,
      property_key: "domain:3vsanantoniopaverservices.com",
    });
  });
});
