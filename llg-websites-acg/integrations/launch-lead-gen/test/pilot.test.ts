import { describe, expect, it } from "vitest";
import { websiteEmbedScript } from "../src/widget";
import { websiteTextWidgetScript } from "../src/text-widget";
import { buildPilotLeadMessage } from "../src/zapier";
import type { CanonicalFilloutSubmission, FilloutIngestResult } from "../src/types";

describe("verified five-site pilot", () => {
  it("builds a stable, property-aware Zapier queue message", () => {
    const submission: CanonicalFilloutSubmission = {
      submissionId: "sub-pilot-1",
      submissionTime: "2026-08-05T12:00:00Z",
      propertyKey: "domain:pghpoolservice.com",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      phone: "+14125550199",
      email: "jane@example.com",
      addressLine1: "123 Main St",
      addressLine2: "",
      city: "Pittsburgh",
      stateRegion: "PA",
      postalCode: "15222",
      message: "Weekly pool service",
      consentGranted: true,
      consentText: "Test consent",
      consentVersion: "v1",
      attribution: { utm_source: "google", gclid: "click-1" },
      answers: { project_type: ["Routine cleaning"] },
      questions: [],
      urlParameters: [],
    };
    const result: FilloutIngestResult = {
      accepted: true,
      duplicate: false,
      leadId: 42,
      leadPublicId: "b7669934-a011-4005-9480-9450b797a191",
      propertyId: 5,
      serviceId: 7,
      testMode: true,
    };

    const message = buildPilotLeadMessage("hCdocVVVcqus", submission, result);
    expect(message.kind).toBe("pilot-lead");
    expect(message.idempotencyKey).toBe("fillout:sub-pilot-1");
    expect(message.propertyKey).toBe("domain:pghpoolservice.com");
    expect(message.contact.phone).toBe("+14125550199");
    expect(message.attribution.gclid).toBe("click-1");
  });

  it("ships a generic loader that resolves configuration and passes attribution", () => {
    const script = websiteEmbedScript();
    expect(script).toContain("data-site-key");
    expect(script).toContain("/sites/config");
    expect(script).toContain("data-fillout-id");
    expect(script).toContain("site_key");
    expect(script).toContain("gclid");
    expect(script).toContain("landing_page_url");
    expect(script).toContain("https://server.fillout.com/embed/v1/");
  });

  it("ships an accessible lower-right texting widget with TextMagic handoff", () => {
    const script = websiteTextWidgetScript();
    expect(script).toContain("/v1/website-text-starts");
    expect(script).toContain("data-services");
    expect(script).toContain("TextMagic");
    expect(script).toContain("Reply STOP to opt out");
    expect(script).toContain('role="dialog"');
    expect(script).toContain('aria-expanded="false"');
    expect(script).toContain("firstTouch");
    expect(script).toContain("turnstileToken");
  });
});
