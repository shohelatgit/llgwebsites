import { describe, expect, it, vi } from "vitest";
import { normalizeLead, originAllowed, parseAllowedOrigins, validateTurnstile } from "../src/index";

const validLead = {
  siteKey: "austin-drain-guys",
  pagePath: "/contact/",
  firstName: "  Ada ",
  lastName: " Lovelace ",
  phone: "512-555-0100",
  email: "ADA@EXAMPLE.COM",
  zip: "78701",
  service: "yard-drainage",
  message: "Standing water near the patio after rain.",
  smsConsent: false,
  company: "",
  turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
  utm: { utm_source: "search", ignored: "value" },
  referrer: "https://example.com/",
  landingPage: "https://clone-rebuild.austin-drain-guys.pages.dev/contact/",
};

describe("normalizeLead", () => {
  it("normalizes valid input and keeps consent false by default", () => {
    const lead = normalizeLead(validLead);
    expect(lead.firstName).toBe("Ada");
    expect(lead.email).toBe("ada@example.com");
    expect(lead.smsConsent).toBe(false);
    expect(lead.utm).toEqual({ utm_source: "search" });
  });

  it("rejects malformed email, phone, and ZIP values", () => {
    expect(() => normalizeLead({ ...validLead, email: "bad" })).toThrow(/valid email/i);
    expect(() => normalizeLead({ ...validLead, phone: "123" })).toThrow(/valid phone/i);
    expect(() => normalizeLead({ ...validLead, zip: "ABCDE" })).toThrow(/valid ZIP/i);
  });
});

describe("origin routing", () => {
  const encoded = '["https://clone-rebuild.austin-drain-guys.pages.dev","http://localhost:4173"]';
  it("allows only exact configured origins", () => {
    expect(originAllowed("https://clone-rebuild.austin-drain-guys.pages.dev", encoded)).toBe(true);
    expect(originAllowed("https://attacker.example", encoded)).toBe(false);
  });

  it("fails closed for invalid route JSON", () => {
    expect(parseAllowedOrigins("not-json")).toEqual([]);
  });
});

describe("Turnstile server validation", () => {
  it("accepts the expected action and hostname", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, action: "lead_submit", hostname: "clone-rebuild.austin-drain-guys.pages.dev" }));
    await expect(validateTurnstile("token", null, "lead_submit", "clone-rebuild.austin-drain-guys.pages.dev", "test-secret", fetcher)).resolves.toEqual({ valid: true });
  });

  it("rejects replayed tokens", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }));
    await expect(validateTurnstile("token", null, "lead_submit", "example.com", "test-secret", fetcher)).resolves.toEqual({ valid: false, code: "turnstile_replay" });
  });

  it("rejects action and hostname mismatches", async () => {
    const wrongAction = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, action: "login", hostname: "example.com" }));
    await expect(validateTurnstile("token", null, "lead_submit", "example.com", "test-secret", wrongAction)).resolves.toEqual({ valid: false, code: "turnstile_action_mismatch" });
    const wrongHost = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, action: "lead_submit", hostname: "attacker.example" }));
    await expect(validateTurnstile("token", null, "lead_submit", "example.com", "test-secret", wrongHost)).resolves.toEqual({ valid: false, code: "turnstile_hostname_mismatch" });
  });

  it("permits test-key metadata only when staging explicitly allows it", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ success: true, action: "test", hostname: "example.invalid" }));
    await expect(validateTurnstile("token", null, "lead_submit", "example.com", "test-secret", fetcher)).resolves.toEqual({ valid: false, code: "turnstile_action_mismatch" });
    await expect(validateTurnstile("token", null, "lead_submit", "example.com", "test-secret", fetcher, true)).resolves.toEqual({ valid: true });
  });
});
