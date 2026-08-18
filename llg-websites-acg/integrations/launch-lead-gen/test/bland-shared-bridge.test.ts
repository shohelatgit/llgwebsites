import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTriageContext, parseBlandContextRequest, resolveBlandVoiceContext } from "../src/bland";
import type { RuntimeEnv } from "../src/types";

const env = {
  BLAND_WEBHOOK_TOKEN: "bland-hook-token",
  BLAND_INGEST_TOKEN: "bland-ingest-token",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable",
} as unknown as RuntimeEnv;

describe("shared Bland answering-number bridge", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the recent signed CallRail pre-call event to resolve the brand from the caller", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        matched: false,
        reason: "phone_not_assigned",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        matched: true,
        property_key: "domain:3vsanantoniopaverservices.com",
        dialed_phone: "+12107968693",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        matched: true,
        property_key: "domain:3vsanantoniopaverservices.com",
        company: {
          display_name: "3V San Antonio Paver Services",
          city: "San Antonio",
          state_region: "TX",
        },
        assistant: {
          name: "Alex",
          transfer_phone: null,
          settings: { pilot_scope: true, allow_transfer: false },
        },
        services: [{ name: "Concrete & Pavers" }],
        service_areas: [],
        availability: [],
      }), { status: 200 }));

    const parsed = parseBlandContextRequest({
      to: "+12109400011",
      from: "+12105550199",
    });
    await expect(resolveBlandVoiceContext(env, parsed, "", null)).resolves.toMatchObject({
      matched: true,
      property_key: "domain:3vsanantoniopaverservices.com",
      company: { display_name: "3V San Antonio Paver Services" },
      call_resolution: {
        matched: true,
        dialed_phone: "+12107968693",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("greets as the business receptionist without announcing AI", () => {
    const triageContext = buildTriageContext({
      matched: true,
      company: {
        display_name: "3V San Antonio Paver Services",
        city: "San Antonio",
        state_region: "TX",
      },
      assistant: {
        name: "Caylee",
        transfer_phone: null,
        settings: { pilot_scope: true, allow_transfer: false },
      },
      services: [{ name: "Concrete & Pavers" }],
      service_areas: [],
      availability: [],
    });
    expect(triageContext).toContain("Thanks for calling 3V Paver Services");
    expect(triageContext).not.toContain("AI assistant");
  });
});
