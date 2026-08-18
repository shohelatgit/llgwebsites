import type { LeadMessage, MetaLeadNotification } from "./types";

type JsonObject = Record<string, unknown>;

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function normalizePhone(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

function isoTimestamp(value: unknown, fallback: string): string {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

export function normalizeCallRail(
  payload: JsonObject,
  eventType: string,
  receivedAt: string,
): LeadMessage {
  const id = text(payload.id || payload.call_id || payload.form_submission_id);
  if (!id) throw new Error("missing_callrail_id");
  const fullName = text(payload.customer_name || payload.name);
  const [firstName = "", ...lastParts] = fullName.split(/\s+/).filter(Boolean);
  const phone = normalizePhone(payload.customer_phone_number || payload.phone_number || payload.phone);
  const email = text(payload.customer_email || payload.email).toLowerCase();
  const timestamp = isoTimestamp(payload.created_at || payload.timestamp, receivedAt);
  const sourceKey = `callrail:${id}`;
  const routingKeys = [
    payload.tracker_id || payload.tracking_phone_number_id
      ? `callrail:tracker:${text(payload.tracker_id || payload.tracking_phone_number_id)}`
      : "",
    payload.company_id ? `callrail:company:${text(payload.company_id)}` : "",
    payload.campaign_id ? `callrail:campaign:${text(payload.campaign_id)}` : "",
  ].filter(Boolean);
  const metadata = {
    eventType,
    companyId: payload.company_id,
    trackingNumberId: payload.tracker_id || payload.tracking_phone_number_id,
    sourceName: payload.source_name || payload.formatted_tracking_source,
    answered: payload.answered,
    duration: payload.duration,
    leadStatus: payload.lead_status,
  };

  return {
    kind: "lead",
    source: "CallRail",
    sourceKey,
    externalId: id,
    routingKeys,
    fields: {
      "Lead ID": `callrail_${id}`,
      "Lead Date": timestamp.slice(0, 10),
      "Lead Timestamp": timestamp,
      "First Name": firstName,
      "Last Name": lastParts.join(" "),
      "Full Name": fullName,
      "Phone": phone,
      "Normalized Phone": phone,
      "Email": email,
      "Normalized Email": email,
      "Lead Source": "Paid",
      "Paid / Organic": "Paid",
      "Lead Type": eventType.includes("form") ? "Form" : "Call",
      "Conversion Source": "CallRail",
      "Attribution Model": "Platform Reported",
      "Source Detail": text(payload.formatted_tracking_source || payload.source_name || "CallRail"),
      "Platform": "CallRail",
      "Campaign": text(payload.campaign_name || payload.campaign_id),
      "Landing Page": text(payload.landing_page_url || payload.landing_page),
      "UTM Source": text(payload.utm_source),
      "UTM Medium": text(payload.utm_medium),
      "UTM Campaign": text(payload.utm_campaign),
      "Lead Status": "New",
      "CallRail Call ID": id,
      "Tracking Number": text(payload.tracking_phone_number || payload.formatted_tracking_phone_number),
      "Call Recording URL": text(payload.recording || payload.recording_url),
      "Call Duration Seconds": Number(payload.duration ?? 0),
      "Routing Status": "Unrouted",
      "Delivery Status": "Not Ready",
      "Source Record ID": id,
      "Source Metadata": JSON.stringify(metadata),
      "Source Key": sourceKey,
      "Imported At": receivedAt,
    },
  };
}

export function normalizeMetaNotification(payload: JsonObject): MetaLeadNotification[] {
  const notifications: MetaLeadNotification[] = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const entryObject = entry as JsonObject;
    const changes = Array.isArray(entryObject.changes) ? entryObject.changes : [];
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const changeObject = change as JsonObject;
      if (text(changeObject.field) !== "leadgen") continue;
      const value = changeObject.value;
      if (!value || typeof value !== "object") continue;
      const lead = value as JsonObject;
      const leadgenId = text(lead.leadgen_id);
      const pageId = text(lead.page_id || entryObject.id);
      if (!leadgenId || !pageId) continue;
      notifications.push({
        kind: "meta-lead-notification",
        source: "Meta Ads",
        sourceKey: `meta:${leadgenId}`,
        externalId: leadgenId,
        pageId,
        formId: text(lead.form_id) || undefined,
        adId: text(lead.ad_id) || undefined,
        adGroupId: text(lead.adgroup_id) || undefined,
        createdTime: Number(lead.created_time) || undefined,
      });
    }
  }
  return notifications;
}

export function metaFieldMap(fieldData: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!Array.isArray(fieldData)) return result;
  for (const item of fieldData) {
    if (!item || typeof item !== "object") continue;
    const row = item as JsonObject;
    const name = text(row.name).toLowerCase();
    const values = Array.isArray(row.values) ? row.values.map(text).filter(Boolean) : [];
    if (name && values.length) result[name] = values.join(", ");
  }
  return result;
}
