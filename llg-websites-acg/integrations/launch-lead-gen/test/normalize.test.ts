import { describe, expect, it } from "vitest";
import { normalizeCallRail, normalizeMetaNotification } from "../src/normalize";

describe("CallRail normalization", () => {
  it("creates a stable source key and Airtable lead fields", () => {
    const lead = normalizeCallRail({ id: 123, tracker_id: "TRK123", customer_name: "Jane Doe", customer_phone_number: "212-555-0199", created_at: "2026-07-31T12:00:00Z" }, "post_call", "2026-07-31T12:01:00Z");
    expect(lead.sourceKey).toBe("callrail:123");
    expect(lead.routingKeys).toContain("callrail:tracker:TRK123");
    expect(lead.fields["Normalized Phone"]).toBe("+12125550199");
    expect(lead.fields["Lead Source"]).toBe("Paid");
  });
});

describe("Meta webhook normalization", () => {
  it("extracts only leadgen changes", () => {
    const notices = normalizeMetaNotification({ entry: [{ id: "page-1", changes: [{ field: "leadgen", value: { leadgen_id: "lead-1", form_id: "form-1" } }] }] });
    expect(notices).toHaveLength(1);
    expect(notices[0]?.sourceKey).toBe("meta:lead-1");
  });
});
