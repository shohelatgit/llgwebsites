import { describe, expect, it } from "vitest";
import { canonicalWebsiteLead, canonicalWebsiteTextStart, FACTORY_WEBSITE_SITE_COUNT, isProductionWebsiteOrigin, websiteCorsOrigin, WEBSITE_SITES, websiteTurnstileSecret } from "../src/website-lead";
import type { RuntimeEnv } from "../src/types";

const payload = {
  submissionId: "3d0ec8a7-9522-4d22-97d1-31fb13516a41",
  siteKey: "austin-drain-guys",
  pagePath: "/contact/",
  firstName: "Jane",
  lastName: "Doe",
  phone: "(512) 555-0199",
  email: "JANE@example.com",
  zip: "78701",
  service: "yard-drainage",
  message: "Water collects beside the foundation after heavy rain.",
  smsConsent: true,
  utm: { utm_source: "google", gclid: "click-123" },
  landingPage: "https://clone-rebuild.austin-drain-guys.pages.dev/contact/",
};

describe("website lead intake", () => {
  it("maps every legacy and factory site to a domain property key", () => {
    expect(FACTORY_WEBSITE_SITE_COUNT).toBe(115);
    expect(Object.keys(WEBSITE_SITES)).toHaveLength(144);
    expect(WEBSITE_SITES["nashville-crawlspace"]!.propertyKey).toBe("domain:nashville-crawlspace.com");
    expect(WEBSITE_SITES["pittsburgh-french-drain"]!.pagesProject).toBe("pittsburgh-french-drain-site");
    expect(WEBSITE_SITES["loc-040"]!.propertyKey).toBe("domain:outdoordrainagesolutionsbridgeportct.com");
    expect(WEBSITE_SITES["llg-drainscape"]!.propertyKey).toBe("domain:drainscapesolutions.com");
  });

  it("normalizes a direct website submission into the provider contract", () => {
    const event = canonicalWebsiteLead(payload, "request-123", "2026-08-09T12:00:00.000Z", true);
    expect(event.provider).toBe("website");
    expect(event.property_key).toBe("domain:austindrainguys.com");
    expect(event.contact.phone).toBe("+15125550199");
    expect(event.contact.email).toBe("jane@example.com");
    expect(event.consent.sms_granted).toBe(true);
    expect(event.attribution.gclid).toBe("click-123");
    expect(event.acquisition_source).toBe("google_ads");
  });

  it("accepts a full-address hero request when a separate ZIP field is unavailable", () => {
    const event = canonicalWebsiteLead({ ...payload, zip: "", address: "123 Main Street, Austin, TX 78701" }, "request-address", "2026-08-09T12:00:00.000Z", true);
    expect(event.contact).toMatchObject({ address_line_1: "123 Main Street, Austin, TX 78701", postal_code: "" });
  });

  it("only accepts origins assigned to the submitted site", () => {
    const good = new Request("https://worker.test/v1/website-leads", { headers: { origin: "https://clone-rebuild.austin-drain-guys.pages.dev" } });
    const wrong = new Request("https://worker.test/v1/website-leads", { headers: { origin: "https://clone-rebuild.dallas-drain-guys.pages.dev" } });
    expect(websiteCorsOrigin(good, "austin-drain-guys")).toBe("https://clone-rebuild.austin-drain-guys.pages.dev");
    expect(websiteCorsOrigin(wrong, "austin-drain-guys")).toBeNull();
  });

  it("accepts the exact factory Worker origin and rejects a cross-site Worker", () => {
    const assigned = new Request("https://worker.test/v1/website-leads", { headers: { origin: "https://llg-site-outdoordrainagesolutionsbridgeportct.justin-b75.workers.dev" } });
    const crossSite = new Request("https://worker.test/v1/website-leads", { headers: { origin: "https://llg-site-outdoordrainagesolutionsseattlewa.justin-b75.workers.dev" } });
    expect(websiteCorsOrigin(assigned, "loc-040")).toBe("https://llg-site-outdoordrainagesolutionsbridgeportct.justin-b75.workers.dev");
    expect(websiteCorsOrigin(crossSite, "loc-040")).toBeNull();
  });

  it("only promotes the assigned real domain out of test mode", () => {
    expect(isProductionWebsiteOrigin("https://austindrainguys.com", "austin-drain-guys")).toBe(true);
    expect(isProductionWebsiteOrigin("https://www.austindrainguys.com", "austin-drain-guys")).toBe(true);
    expect(isProductionWebsiteOrigin("https://austin-drain-guys.pages.dev", "austin-drain-guys")).toBe(false);
  });

  it("selects the provisioned Turnstile secret for factory production origins", () => {
    const env = {
      TURNSTILE_SECRET_KEY: "review-secret",
      TURNSTILE_SECRET_KEY_A: "production-a-secret",
      TURNSTILE_SECRET_KEY_B: "production-b-secret",
    } as RuntimeEnv;
    expect(websiteTurnstileSecret(env, "loc-044", "https://baltimorefrenchdrain.com")).toBe("production-a-secret");
    expect(websiteTurnstileSecret(env, "loc-042", "https://neworleansfrenchdrain.com")).toBe("production-b-secret");
    expect(websiteTurnstileSecret(env, "loc-040", "https://llg-site-outdoordrainagesolutionsbridgeportct.justin-b75.workers.dev")).toBe("review-secret");
    expect(websiteTurnstileSecret(env, "loc-040", "https://outdoordrainagesolutionsbridgeportct.com")).toBe("");
  });

  it("rejects malformed contact and location data", () => {
    expect(() => canonicalWebsiteLead({ ...payload, email: "not-an-email" }, "r", "2026-08-09T12:00:00Z", true)).toThrow("invalid_email");
    expect(() => canonicalWebsiteLead({ ...payload, zip: "123" }, "r", "2026-08-09T12:00:00Z", true)).toThrow("invalid_zip");
  });

  it("creates an SMS conversion with the exact widget consent record", () => {
    const textEvent = canonicalWebsiteTextStart({
      submissionId: "widget-1",
      siteKey: "austin-drain-guys",
      fullName: "Jane Doe",
      phone: "(512) 555-0199",
      zip: "78701",
      service: "Yard Drainage",
      message: "Water collects beside the foundation.",
      smsConsent: true,
      consentText: "I agree to receive automated service-related text messages. Reply STOP to opt out.",
      consentVersion: "website-text-widget-v1",
      lastTouch: { utm_source: "google", gclid: "click-123" },
    }, "request-widget", "2026-08-11T12:00:00.000Z", true);
    expect(textEvent.conversion_channel).toBe("sms");
    expect(textEvent.event_type).toBe("website_text_start");
    expect(textEvent.contact.normalized_phone).toBe("+15125550199");
    expect(textEvent.consent).toMatchObject({ sms_granted: true, version: "website-text-widget-v1" });
    expect(textEvent.service.requested).toBe("Yard Drainage");
  });

  it("requires explicit SMS consent for widget starts", () => {
    expect(() => canonicalWebsiteTextStart({
      siteKey: "austin-drain-guys",
      fullName: "Jane Doe",
      phone: "5125550199",
      service: "Yard Drainage",
      message: "Water collects beside the foundation.",
      smsConsent: false,
      consentText: "Consent text",
    }, "request-widget", "2026-08-11T12:00:00.000Z", true)).toThrow("sms_consent_required");
  });
});
