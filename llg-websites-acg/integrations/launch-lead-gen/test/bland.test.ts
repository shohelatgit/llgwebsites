import { describe, expect, it } from "vitest";
import { buildServiceAreaGuidance, buildTriageContext, deriveSpokenBusinessName, getBlandCallId, isBlandLiveEventPayload, isPilotVoiceContext, normalizePhoneNumber, parseBlandContextRequest } from "../src/bland";

describe("Bland routing helpers", () => {
  it("normalizes common North American and E.164 phone formats", () => {
    expect(normalizePhoneNumber("(508) 555-0199")).toBe("+15085550199");
    expect(normalizePhoneNumber("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhoneNumber("not-a-number")).toBe("");
  });

  it("extracts property and lead identity from pathway metadata", () => {
    expect(parseBlandContextRequest({
      to: "+1 (508) 555-0199",
      metadata: {
        property_key: "domain:example.com",
        lead_public_id: "f3cb3d0e-23a1-4d0d-8f16-75ab764f1827",
      },
    })).toEqual({
      phoneNumber: "+15085550199",
      dialedNumber: "+15085550199",
      callerNumber: "",
      propertyKey: "domain:example.com",
      leadPublicId: "f3cb3d0e-23a1-4d0d-8f16-75ab764f1827",
    });
  });

  it("separates the shared Bland destination from the original caller", () => {
    expect(parseBlandContextRequest({
      to: "+14155550100",
      from: "+12105550199",
    })).toMatchObject({
      phoneNumber: "+14155550100",
      dialedNumber: "+14155550100",
      callerNumber: "+12105550199",
    });
  });

  it("accepts both Bland call ID fields", () => {
    expect(getBlandCallId({ call_id: "call-1" })).toBe("call-1");
    expect(getBlandCallId({ c_id: "call-2" })).toBe("call-2");
  });

  it("separates streamed Bland events from completed post-call payloads", () => {
    expect(isBlandLiveEventPayload({
      call_id: "call-1",
      category: "call",
      message: "Call started",
    })).toBe(true);
    expect(isBlandLiveEventPayload({
      call_id: "call-1",
      category: "call",
      completed: true,
      summary: "Caller requested a quote.",
    })).toBe(false);
    expect(isBlandLiveEventPayload({
      call_id: "call-1",
      completed: true,
      transcripts: [],
    })).toBe(false);
  });

  it("builds a Norm-compatible snippet only for pilot properties", () => {
    const context = {
      matched: true,
      company: { display_name: "PGH Pool Service", city: "Pittsburgh", state_region: "PA" },
      assistant: { name: "Alex", transfer_phone: null, settings: { pilot_scope: true, allow_transfer: false } },
      services: [{ name: "Pool Service" }],
      service_areas: [],
      availability: [],
    };
    expect(isPilotVoiceContext(context)).toBe(true);
    expect(buildTriageContext(context)).toContain("PGH Pool Service serves Pittsburgh, PA for Pool Service");
    expect(buildTriageContext(context)).toContain("No live calendar availability is loaded");
    expect(buildTriageContext({ ...context, assistant: { settings: { pilot_scope: false } } })).toBe("");
  });

  it("uses an explicit natural spoken business name in the greeting", () => {
    const context = {
      matched: true,
      company: {
        display_name: "High-End Retaining Wall Contractors of St. Louis",
        city: "St. Louis",
        state_region: "MO",
      },
      assistant: {
        name: "Caylee",
        settings: {
          pilot_scope: true,
          spoken_business_name: "St. Louis Retaining Walls",
        },
      },
      services: [{ name: "Retaining Walls" }],
      service_areas: [],
      availability: [],
    };
    expect(deriveSpokenBusinessName(context)).toBe("St. Louis Retaining Walls");
    expect(buildTriageContext(context)).toContain(
      'Start with exactly: "Thanks for calling St. Louis Retaining Walls, how can I help you today?"',
    );
  });

  it("automatically derives a short spoken name for future long-form properties", () => {
    expect(deriveSpokenBusinessName({
      company: {
        display_name: "Outdoor Drainage Solutions of Bridgeport",
        city: "Bridgeport",
      },
      assistant: { settings: {} },
      services: [{ name: "Drainage & French Drains" }],
    })).toBe("Bridgeport Drainage Solutions");
  });

  it("loads a compact radius and city list into the call-start guidance", () => {
    const guidance = buildServiceAreaGuidance({
      company: { city: "St. Louis" },
      service_areas: [
        { area_type: "radius", radius_miles: 30, included: true },
        { area_type: "city", city: "St. Louis", included: true },
        { area_type: "city", city: "Kirkwood", included: true },
        { area_type: "city", city: "Excluded City", included: false },
      ],
    });
    expect(guidance).toContain("30 miles from St. Louis");
    expect(guidance).toContain("St. Louis, Kirkwood");
    expect(guidance).not.toContain("Excluded City");
    expect(guidance).toContain("project city and ZIP code");
  });
});
