import { describe, expect, it } from "vitest";
import { parseFilloutSubmission } from "../src/fillout";
import { CONTACT_CONSENT_TEXT, CONTACT_CONSENT_VERSION } from "../src/fillout-schema";

describe("Fillout submission normalization", () => {
  it("captures the site key, attribution, consent, and vertical answers", () => {
    const submission = parseFilloutSubmission({
      submissionId: "sub-123",
      submissionTime: "2026-08-04T18:00:00Z",
      questions: [
        { id: "name", name: "Name", type: "ShortAnswer", value: "Jane Doe" },
        { id: "phone", name: "Phone number", type: "PhoneNumber", value: "412-555-0199" },
        { id: "email", name: "Email", type: "EmailInput", value: "JANE@EXAMPLE.COM" },
        { id: "address", name: "Street Address", type: "ShortAnswer", value: "123 Main St" },
        { id: "city", name: "City", type: "ShortAnswer", value: "Akron" },
        { id: "zip", name: "ZIP Code", type: "ShortAnswer", value: "44308" },
        { id: "project", name: "What drainage help do you need?", type: "MultipleChoice", value: ["French drain", "Yard drainage"] },
        { id: "consent", name: "Contact consent", type: "Checkbox", value: ["I agree"] },
      ],
      urlParameters: [
        { id: "site", name: "site_key", value: "akron-drain-pros" },
        { id: "source", name: "utm_source", value: "google" },
        { id: "medium", name: "utm_medium", value: "cpc" },
        { id: "click", name: "gclid", value: "gclid-123" },
      ],
    }, "2026-08-04T18:01:00Z");

    expect(submission.submissionId).toBe("sub-123");
    expect(submission.propertyKey).toBe("akron-drain-pros");
    expect(submission.fullName).toBe("Jane Doe");
    expect(submission.firstName).toBe("Jane");
    expect(submission.lastName).toBe("Doe");
    expect(submission.phone).toBe("+14125550199");
    expect(submission.email).toBe("jane@example.com");
    expect(submission.attribution.source_category).toBe("paid");
    expect(submission.attribution.gclid).toBe("gclid-123");
    expect(submission.answers.project_type).toEqual(["French drain", "Yard drainage"]);
    expect(submission.consentGranted).toBe(true);
    expect(submission.consentText).toBe(CONTACT_CONSENT_TEXT);
    expect(submission.consentVersion).toBe(CONTACT_CONSENT_VERSION);
  });

  it("rejects submissions without a verified site identity", () => {
    expect(() => parseFilloutSubmission({ submissionId: "sub-123", questions: [], urlParameters: [] }, "2026-08-04T18:01:00Z"))
      .toThrow("missing_site_key");
  });

  it("rejects submissions without explicit contact consent", () => {
    expect(() => parseFilloutSubmission({
      submissionId: "sub-123",
      questions: [
        { name: "Name", value: "Jane Doe" },
        { name: "Phone number", value: "412-555-0199" },
        { name: "Email", value: "jane@example.com" },
        { name: "Contact consent", value: false },
      ],
      urlParameters: [{ name: "site_key", value: "akron-drain-pros" }],
    }, "2026-08-04T18:01:00Z")).toThrow("contact_consent_required");
  });

  it("accepts the wrapped payload emitted by Fillout webhooks", () => {
    const submission = parseFilloutSubmission({
      formId: "gmUU3C2zpKus",
      formName: "LLG Template — Drainage & French Drains — TEST",
      submission: {
        submissionId: "wrapped-sub-123",
        submissionTime: "2026-08-04T18:00:00Z",
        questions: [
          { name: "Name", value: "Jane Doe" },
          { name: "Phone number", value: "412-555-0199" },
          { name: "Email", value: "jane@example.com" },
          { name: "Contact consent", value: ["I agree"] },
        ],
        urlParameters: [{ name: "site_key", value: "domain:example.com" }],
      },
    }, "2026-08-04T18:01:00Z");

    expect(submission.submissionId).toBe("wrapped-sub-123");
    expect(submission.propertyKey).toBe("domain:example.com");
    expect(submission.email).toBe("jane@example.com");
  });
});
