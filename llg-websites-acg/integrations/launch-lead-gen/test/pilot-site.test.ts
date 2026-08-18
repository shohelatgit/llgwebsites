import { describe, expect, it } from "vitest";
import { pilotSiteCss, pilotSiteHtml, pilotSiteScript } from "../src/pilot-site";
import type { PilotSiteConfig } from "../src/types";

const config: PilotSiteConfig = {
  property_key: "domain:3vsanantoniopaverservices.com",
  domain: "3vsanantoniopaverservices.com",
  display_name: "3V San Antonio Paver Services",
  primary_phone: "+12107968693",
  sms_phone: "+18337689020",
  sms_enabled: true,
  city: "San Antonio",
  state_region: "TX",
  timezone: "America/Chicago",
  consent_disclosure: "Test consent",
  test_mode: true,
  form: { provider: "fillout", form_id: "nVe595EMkqus", template_key: "concrete-pavers", status: "testing" },
  services: [{ slug: "concrete-pavers", name: "Concrete & Pavers" }],
};

describe("pilot website", () => {
  it("renders verified property data and the shared Fillout loader", () => {
    const html = pilotSiteHtml(config, true);
    expect(html).toContain("3V San Antonio Paver Services");
    expect(html).toContain("A simple way to start your project.");
    expect(html).toContain("(210) 796-8693");
    expect(html).toContain('href="sms:+18337689020"');
    expect(html).toContain("(833) 768-9020");
    expect(html).toContain('data-site-key="domain:3vsanantoniopaverservices.com"');
    expect(html).toContain('content="noindex,nofollow,noarchive"');
    expect(html).not.toContain("canonical");
  });

  it("hides SMS actions when the verified inventory does not support them", () => {
    expect(pilotSiteHtml(config, false)).not.toContain('href="sms:');
  });

  it("ships responsive styling and accessible dialog controls", () => {
    expect(pilotSiteCss()).toContain("@media(max-width:800px)");
    expect(pilotSiteScript()).toContain("showModal");
    expect(pilotSiteScript()).toContain("data-open-quote");
  });
});
