import { describe, expect, it } from "vitest";
import { canonicalCallRailEvent, canonicalFilloutEvent, canonicalMetaLeadEvent } from "../src/canonical";

describe("canonical provider events", () => {
  it("keeps conversion channel separate from Google Ads acquisition", () => {
    const event = canonicalCallRailEvent({
      id: "call-1", tracker_id: "TRK1", tracking_phone_number: "+16015550100",
      customer_phone_number: "+16015550101", gclid: "gclid-1", created_at: "2026-08-06T12:00:00Z",
    }, "call", "2026-08-06T12:00:01Z", "req-1", true);
    expect(event.acquisition_source).toBe("google_ads");
    expect(event.conversion_channel).toBe("phone_call");
    expect(event.mapping_keys).toContainEqual({ platform: "CallRail", external_type: "Tracker Number", external_id: "TRK1:+16015550100" });
  });

  it("requires Fillout site_key evidence and preserves consent/session attribution", () => {
    const event = canonicalFilloutEvent("form-1", {
      submissionId: "sub-1", submissionTime: "2026-08-06T12:00:00Z", propertyKey: "domain:example.com",
      fullName: "Jane Doe", firstName: "Jane", lastName: "Doe", phone: "+16015550101", email: "jane@example.com",
      addressLine1: "", addressLine2: "", city: "Jackson", stateRegion: "MS", postalCode: "39201", message: "Drainage help",
      consentGranted: true, consentText: "Contact consent", consentVersion: "v1", attribution: { session_id: "session-1", utm_source: "google", utm_medium: "cpc" },
      answers: { project_timeline: "Soon" }, questions: [], urlParameters: [],
    }, { submissionId: "sub-1" }, "req-2", true);
    expect(event.property_key).toBe("domain:example.com");
    expect(event.acquisition_source).toBe("google_ads");
    expect(event.consent).toMatchObject({ granted: true, version: "v1" });
    expect(event.correlation_ids.session_id).toBe("session-1");
  });

  it("maps Meta Lead Ads explicitly as paid acquisition through a form conversion", () => {
    const event = canonicalMetaLeadEvent({ campaign_id: "cmp-1", form_id: "form-1" }, {
      externalId: "lead-1", pageId: "page-1", formId: "form-1",
    }, { full_name: "Jane Doe", phone_number: "6015550101", email: "jane@example.com" }, "req-3", true);
    expect(event.acquisition_source).toBe("meta_ads");
    expect(event.conversion_channel).toBe("website_form");
    expect(event.mapping_keys).toContainEqual({ platform: "Meta", external_type: "form_id", external_id: "form-1" });
  });
});
