import { describe, expect, it } from "vitest";
import { isFreshTimestamp, verifyBlandWebhookSignature, verifyCallRailSignature, verifyCallRailSignatures } from "../src/security";

describe("CallRail signature verification", () => {
  it("matches CallRail's published HMAC-SHA1 test vector", async () => {
    const publishedBody = '{"answered":false,"business_phone_number":"","call_type":"voicemail","company_id":155920786,"company_name":"Boost Marketing","company_time_zone":"America/Los_Angeles","created_at":"2018-02-19T13:41:00.252-05:00","customer_city":"Rochester","customer_country":"US","customer_name":"Kaylah Mills","customer_phone_number":"+12148654559","customer_state":"PA","device_type":"","direction":"inbound","duration":"13","first_call":false,"formatted_call_type":"Voicemail","formatted_customer_location":"Rochester, PA","formatted_business_phone_number":"","formatted_customer_name":"Kaylah Mills","prior_calls":16,"formatted_customer_name_or_phone_number":"Kaylah Mills","formatted_customer_phone_number":"214-865-4559","formatted_duration":"13s","formatted_tracking_phone_number":"404-555-8514","formatted_tracking_source":"Google Paid","formatted_value":"--","good_lead_call_id":715587840,"good_lead_call_time":"2016-06-17T10:23:33.363-04:00","id":766970532,"lead_status":"previously_marked_good_lead","note":"","recording":"https://app.callrail.com/calls/766970532/recording/redirect?access_key=aaaaccccddddeeee","recording_duration":8,"source_name":"Google AdWords","start_time":"2018-02-19T13:41:00.236-05:00","tags":[],"total_calls":17,"tracking_phone_number":"+14045558514","transcription":"","value":"","voicemail":true,"tracker_id":354024023,"keywords":"","medium":"","referring_url":"","landing_page_url":"","last_requested_url":"","referrer_domain":"","conversational_transcript":"","utm_source":"google","utm_medium":"cpc","utm_term":"","utm_content":"","utm_campaign":"Google AdWords","utma":"","utmb":"","utmc":"","utmv":"","utmz":"","ga":"","gclid":"","integration_data":[{"integration":"Webhooks","data":null}],"keywords_spotted":"","recording_player":"https://app.callrail.com/calls/766970532/recording?access_key=aaaabbbbccccdddd","speaker_percent":"","call_highlights":[],"callercity":"Rochester","callercountry":"US","callername":"Kaylah Mills","callernum":"+12148654559","callerstate":"PA","callsource":"google_paid","campaign":"","custom":"","datetime":"2018-02-19 18:41:00","destinationnum":"","ip":"","kissmetrics_id":"","landingpage":"","referrer":"","referrermedium":"","score":1,"tag":"","trackingnum":"+14045558514","timestamp":"2018-02-19T13:41:00.236-05:00"}';
    const payload = new TextEncoder().encode(publishedBody);
    const ok = await verifyCallRailSignature(
      payload.buffer,
      "UZAHbUdfm3GqL7qzilGozGzWV64=",
      "072e77e426f92738a72fe23c4d1953b4",
    );
    expect(ok).toBe(true);
  });

  it("accepts one of several company-specific webhook signing keys", async () => {
    const raw = new TextEncoder().encode('{"timestamp":"2026-08-06T01:39:35.999Z"}').buffer;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("company-two-secret"),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, raw))));
    await expect(verifyCallRailSignatures(raw, signature, [
      "company-one-secret",
      "company-two-secret",
      "company-three-secret",
    ])).resolves.toBe(true);
    await expect(verifyCallRailSignatures(raw, signature, ["company-one-secret"])).resolves.toBe(false);
  });
});

describe("webhook replay protection", () => {
  it("accepts recent epoch timestamps and rejects stale ones", () => {
    const now = Date.UTC(2026, 6, 31, 12, 0, 0);
    expect(isFreshTimestamp(now / 1000, now)).toBe(true);
    expect(isFreshTimestamp((now - 16 * 60_000) / 1000, now)).toBe(false);
  });
});

describe("Bland signature verification", () => {
  it("matches HMAC-SHA256 webhook signatures", async () => {
    const raw = new TextEncoder().encode('{"call_id":"test"}').buffer;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("bland-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Array.from(
      new Uint8Array(await crypto.subtle.sign("HMAC", key, raw)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    expect(await verifyBlandWebhookSignature(raw, signature, "bland-secret")).toBe(true);
    expect(await verifyBlandWebhookSignature(raw, signature, "wrong-secret")).toBe(false);
  });
});
