import { normalizePhone } from "./normalize";
import type { CanonicalFilloutSubmission, CanonicalProviderEvent, ProviderMappingKey } from "./types";

type JsonObject = Record<string, unknown>;

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function paidEvidence(attribution: JsonObject): { source: string; confidence: CanonicalProviderEvent["acquisition_confidence"] } {
  const source = text(attribution.utm_source).toLowerCase();
  const medium = text(attribution.utm_medium).toLowerCase();
  if (text(attribution.gclid) || text(attribution.gbraid) || text(attribution.wbraid)
    || (["google", "adwords"].includes(source) && ["cpc", "ppc", "paid", "paid_search"].includes(medium))) {
    return { source: "google_ads", confidence: "confirmed" };
  }
  if (text(attribution.fbclid)
    || (["facebook", "fb", "instagram", "ig", "meta"].includes(source) && ["cpc", "ppc", "paid", "paid_social"].includes(medium))) {
    return { source: "meta_ads", confidence: "confirmed" };
  }
  if (medium.includes("organic")) return { source: "organic", confidence: "explicit" };
  if (text(attribution.referrer_url)) return { source: "referral", confidence: "explicit" };
  return { source: "direct", confidence: "unknown" };
}

function callRailMappingKeys(payload: JsonObject): ProviderMappingKey[] {
  const trackerId = text(payload.tracker_id || payload.tracking_phone_number_id);
  const trackingNumber = normalizePhone(payload.tracking_phone_number || payload.formatted_tracking_phone_number);
  const keys: ProviderMappingKey[] = [];
  if (trackerId) keys.push({ platform: "CallRail", external_type: "Tracker", external_id: trackerId });
  if (trackerId && trackingNumber) keys.push({ platform: "CallRail", external_type: "Tracker Number", external_id: `${trackerId}:${trackingNumber}` });
  return keys;
}

export function canonicalCallRailEvent(
  payload: JsonObject,
  eventType: string,
  receivedAt: string,
  requestId: string,
  testMode: boolean,
): CanonicalProviderEvent {
  const id = text(payload.id || payload.call_id || payload.form_submission_id);
  if (!id) throw new Error("missing_callrail_id");
  const fullName = text(payload.customer_name || payload.name);
  const [firstName = "", ...lastParts] = fullName.split(/\s+/).filter(Boolean);
  const occurredAt = Number.isFinite(Date.parse(text(payload.created_at || payload.timestamp)))
    ? new Date(text(payload.created_at || payload.timestamp)).toISOString()
    : receivedAt;
  const attribution: JsonObject = {
    utm_source: text(payload.utm_source), utm_medium: text(payload.utm_medium), utm_campaign: text(payload.utm_campaign),
    campaign_id: text(payload.campaign_id), campaign_name: text(payload.campaign_name),
    gclid: text(payload.gclid), gbraid: text(payload.gbraid), wbraid: text(payload.wbraid), fbclid: text(payload.fbclid),
    landing_page_url: text(payload.landing_page_url || payload.landing_page), referrer_url: text(payload.referrer_url || payload.referrer),
    keyword: text(payload.keyword), visitor_id: text(payload.visitor_id), session_id: text(payload.session_id),
  };
  const acquisition = paidEvidence(attribution);
  return {
    kind: "provider-event", provider: "callrail", provider_event_id: id, event_type: eventType,
    idempotency_key: `callrail:${id}`, mapping_keys: callRailMappingKeys(payload),
    acquisition_source: acquisition.source, acquisition_confidence: acquisition.confidence,
    conversion_channel: eventType.includes("form") ? "website_form" : "phone_call", occurred_at: occurredAt, test_mode: testMode,
    contact: {
      first_name: firstName, last_name: lastParts.join(" "), full_name: fullName,
      phone: normalizePhone(payload.customer_phone_number || payload.phone_number || payload.phone),
      normalized_phone: normalizePhone(payload.customer_phone_number || payload.phone_number || payload.phone),
      email: text(payload.customer_email || payload.email).toLowerCase(), normalized_email: text(payload.customer_email || payload.email).toLowerCase(),
    },
    consent: { granted: false, text: "", source: "callrail" }, service: {}, qualification: {}, attribution,
    correlation_ids: { callrail_call_id: id, conversation_id: id },
    summary: text(payload.source_name || payload.formatted_tracking_source), raw_payload: payload, request_id: requestId,
  };
}

export function canonicalFilloutEvent(
  formId: string,
  submission: CanonicalFilloutSubmission,
  payload: JsonObject,
  requestId: string,
  testMode: boolean,
): CanonicalProviderEvent {
  const acquisition = paidEvidence(submission.attribution);
  return {
    kind: "provider-event", provider: "fillout", provider_event_id: submission.submissionId, event_type: "form_submission",
    idempotency_key: `fillout:${submission.submissionId}`, property_key: submission.propertyKey,
    mapping_keys: [{ platform: "fillout", external_type: "form_id", external_id: formId }],
    acquisition_source: acquisition.source, acquisition_confidence: acquisition.confidence,
    conversion_channel: "website_form", occurred_at: submission.submissionTime, test_mode: testMode,
    contact: {
      first_name: submission.firstName, last_name: submission.lastName, full_name: submission.fullName,
      phone: submission.phone, normalized_phone: submission.phone, email: submission.email, normalized_email: submission.email,
      address_line_1: submission.addressLine1, address_line_2: submission.addressLine2, city: submission.city,
      state_region: submission.stateRegion, postal_code: submission.postalCode,
    },
    consent: { granted: submission.consentGranted, text: submission.consentText, version: submission.consentVersion, source: "fillout" },
    service: { form_id: formId }, qualification: submission.answers, attribution: submission.attribution,
    correlation_ids: { fillout_submission_id: submission.submissionId, session_id: submission.attribution.session_id || "" },
    message: submission.message, raw_payload: payload, request_id: requestId,
  };
}

export function canonicalMetaLeadEvent(
  payload: JsonObject,
  notice: { externalId: string; pageId: string; formId?: string; adId?: string; adGroupId?: string; createdTime?: number },
  answers: Record<string, string>,
  requestId: string,
  testMode: boolean,
): CanonicalProviderEvent {
  const fullName = answers.full_name || answers.name || "";
  const [firstName = "", ...lastParts] = fullName.split(/\s+/).filter(Boolean);
  const formId = text(payload.form_id || notice.formId);
  const campaignId = text(payload.campaign_id);
  const mappingKeys: ProviderMappingKey[] = [{ platform: "Meta", external_type: "page_id", external_id: notice.pageId }];
  if (formId) mappingKeys.push({ platform: "Meta", external_type: "form_id", external_id: formId });
  if (campaignId) mappingKeys.push({ platform: "Meta", external_type: "campaign_id", external_id: campaignId });
  const createdAt = text(payload.created_time) || (notice.createdTime ? new Date(notice.createdTime * 1000).toISOString() : new Date().toISOString());
  return {
    kind: "provider-event", provider: "meta_lead_ads", provider_event_id: notice.externalId, event_type: "leadgen",
    idempotency_key: `meta_lead_ads:${notice.externalId}`, mapping_keys: mappingKeys,
    acquisition_source: "meta_ads", acquisition_confidence: "confirmed", conversion_channel: "website_form",
    occurred_at: createdAt, test_mode: testMode,
    contact: {
      first_name: answers.first_name || firstName, last_name: answers.last_name || lastParts.join(" "), full_name: fullName,
      phone: normalizePhone(answers.phone_number || answers.phone), normalized_phone: normalizePhone(answers.phone_number || answers.phone),
      email: text(answers.email).toLowerCase(), normalized_email: text(answers.email).toLowerCase(),
    },
    consent: { granted: true, text: "Meta Lead Ads platform consent", source: "meta_lead_ads" },
    service: { requested: answers.service || answers.service_requested || "", form_id: formId }, qualification: answers,
    attribution: {
      campaign_id: campaignId, campaign_name: text(payload.campaign_name), ad_group_id: text(payload.adset_id || notice.adGroupId),
      ad_group_name: text(payload.adset_name), ad_id: text(payload.ad_id || notice.adId), ad_name: text(payload.ad_name), utm_source: "meta", utm_medium: "paid_social",
    },
    correlation_ids: { meta_lead_id: notice.externalId, page_id: notice.pageId, form_id: formId },
    raw_payload: payload, request_id: requestId,
  };
}
