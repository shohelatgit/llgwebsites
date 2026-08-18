import { getBlandVoiceContext, getRecentCallRailVoiceContext, ingestBlandCall, recordBlandWebhookAttempt } from "./supabase";
import type { BlandCallIngestResult, BlandInboundSyncSummary, BlandSyncSummary, RuntimeEnv } from "./types";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePhoneNumber(value: unknown): string {
  const raw = stringValue(value);
  if (!raw) return "";
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (/^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return "";
}

export function getBlandCallId(payload: Record<string, unknown>): string {
  return stringValue(payload.call_id) || stringValue(payload.c_id);
}

const BLAND_LIVE_EVENT_CATEGORIES = new Set([
  "queue",
  "call",
  "latency",
  "webhook",
  "tool",
  "dynamic_data",
  "citations",
]);

export function isBlandLiveEventPayload(payload: Record<string, unknown>): boolean {
  const category = stringValue(payload.category).toLowerCase();
  if (!BLAND_LIVE_EVENT_CATEGORIES.has(category)) return false;

  // Bland's webhook_events stream uses small log envelopes. A completed-call
  // payload contains the call result fields below and must continue to ingestion.
  const hasCompletedCallData = payload.completed === true
    || Array.isArray(payload.transcripts)
    || typeof payload.concatenated_transcript === "string"
    || typeof payload.summary === "string"
    || typeof payload.duration === "number"
    || typeof payload.end_at === "string";
  return !hasCompletedCallData;
}

export interface BlandContextRequest {
  phoneNumber: string;
  dialedNumber: string;
  callerNumber: string;
  propertyKey: string;
  leadPublicId: string | null;
}

export function parseBlandContextRequest(payload: Record<string, unknown>): BlandContextRequest {
  const metadata = objectValue(payload.metadata) ?? {};
  const requestData = objectValue(payload.request_data) ?? {};
  const dialedNumber = normalizePhoneNumber(
    payload.dialed_number ?? payload.tracking_phone_number ?? payload.to
      ?? payload.inbound_number ?? requestData.dialed_number ?? requestData.phone_number,
  );
  const callerNumber = normalizePhoneNumber(
    payload.caller_phone_number ?? payload.customer_phone_number ?? payload.customer_number
      ?? payload.from ?? requestData.caller_phone_number,
  );
  const phoneNumber = dialedNumber || normalizePhoneNumber(payload.phone_number ?? requestData.phone_number);
  const propertyKey = stringValue(payload.property_key)
    || stringValue(metadata.property_key)
    || stringValue(requestData.property_key);
  const candidateLeadId = stringValue(payload.lead_public_id)
    || stringValue(metadata.lead_public_id)
    || stringValue(requestData.lead_public_id);
  const leadPublicId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateLeadId)
    ? candidateLeadId
    : null;
  return { phoneNumber, dialedNumber, callerNumber, propertyKey, leadPublicId };
}

export async function resolveBlandVoiceContext(
  env: RuntimeEnv,
  parsed: BlandContextRequest,
  propertyKey = parsed.propertyKey,
  leadPublicId = parsed.leadPublicId,
): Promise<Record<string, unknown>> {
  let context = await getBlandVoiceContext(
    env,
    parsed.dialedNumber || parsed.phoneNumber,
    propertyKey,
    leadPublicId,
  );
  if (context.matched === true || !parsed.callerNumber) return context;

  const recent = await getRecentCallRailVoiceContext(env, parsed.callerNumber);
  const recentPropertyKey = typeof recent.property_key === "string" ? recent.property_key : "";
  if (recent.matched !== true || !recentPropertyKey) return context;

  context = await getBlandVoiceContext(env, "", recentPropertyKey, leadPublicId);
  return { ...context, call_resolution: recent };
}

async function blandRequest(env: RuntimeEnv, path: string, init: RequestInit = {}): Promise<unknown> {
  if (!env.BLAND_API_KEY) throw new Error("missing_secret:BLAND_API_KEY");
  const response = await fetch(`https://api.bland.ai${path}`, {
    ...init,
    headers: {
      authorization: env.BLAND_API_KEY,
      accept: "application/json",
      "user-agent": "llg-cloudflare-integrations/1.0",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`bland_api_${response.status}`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("bland_api_invalid_response");
  }
}

function contextObject(value: unknown): Record<string, unknown> {
  return objectValue(value) ?? {};
}

function contextString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function isPilotVoiceContext(context: Record<string, unknown>): boolean {
  if (context.matched !== true) return false;
  const assistant = contextObject(context.assistant);
  const settings = contextObject(assistant.settings);
  return settings.pilot_scope === true;
}

function naturalServiceName(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("retaining wall")) return "Retaining Walls";
  if (lower.includes("drain") || lower.includes("french drain")) return "Drainage Solutions";
  if (lower.includes("paver") || lower.includes("concrete")) return "Paver Services";
  if (lower.includes("pool")) return "Pool Service";
  if (lower.includes("crawl")) return "Crawlspace Services";
  if (lower.includes("deck")) return "Deck Builders";
  return value.replace(/\s*&\s*/g, " and ").trim();
}

export function deriveSpokenBusinessName(context: Record<string, unknown>): string {
  const company = contextObject(context.company);
  const assistant = contextObject(context.assistant);
  const settings = contextObject(assistant.settings);
  const explicitName = contextString(settings.spoken_business_name)
    || contextString(company.spoken_name);
  if (explicitName) return explicitName;

  const displayName = contextString(company.display_name);
  const services = Array.isArray(context.services) ? context.services : [];
  const primaryService = services
    .map((item) => contextString(contextObject(item).name))
    .find(Boolean);
  const looksLikeDomain = /\.[a-z]{2,}$/i.test(displayName);
  const words = displayName.split(/\s+/).filter(Boolean);
  const brandPrefix = words[0] ?? "";
  if (primaryService && /(?:\d|^[A-Z]{2,5}$)/.test(brandPrefix)) {
    return `${brandPrefix} ${naturalServiceName(primaryService)}`;
  }
  if (displayName && !looksLikeDomain && words.length <= 4) {
    return displayName.replace(/\b(?:LLC|Inc\.?|Corporation|Corp\.?)$/i, "").trim();
  }

  const city = contextString(company.city);
  if (city && primaryService) return `${city} ${naturalServiceName(primaryService)}`;
  return displayName || contextString(company.domain, "Local Services");
}

export function buildServiceAreaGuidance(context: Record<string, unknown>): string {
  const company = contextObject(context.company);
  const serviceAreas = Array.isArray(context.service_areas) ? context.service_areas : [];
  const includedAreas = serviceAreas.map(contextObject).filter((area) => area.included !== false);
  const radiusArea = includedAreas.find((area) => contextString(area.area_type) === "radius");
  const radiusMiles = Number(radiusArea?.radius_miles);
  const cities = [...new Set(includedAreas
    .filter((area) => contextString(area.area_type) === "city")
    .map((area) => contextString(area.city))
    .filter(Boolean))]
    .slice(0, 12);
  const center = contextString(company.city, cities[0] || "the main market");
  const radiusSentence = Number.isFinite(radiusMiles) && radiusMiles > 0
    ? `The normal service radius is about ${Math.round(radiusMiles)} miles from ${center}.`
    : `The configured service area is centered on ${center}.`;
  const citiesSentence = cities.length
    ? `Common included communities are ${cities.join(", ")}.`
    : "No complete city list is loaded yet.";
  return `${radiusSentence} ${citiesSentence} Always ask for the project city and ZIP code. If the location is not clearly listed, say the team will confirm coverage; never reject or promise coverage by guessing.`;
}

export function buildTriageContext(context: Record<string, unknown>): string {
  if (!isPilotVoiceContext(context)) return "";

  const company = contextObject(context.company);
  const assistant = contextObject(context.assistant);
  const settings = contextObject(assistant.settings);
  const services = Array.isArray(context.services) ? context.services : [];
  const serviceAreas = Array.isArray(context.service_areas) ? context.service_areas : [];
  const availability = Array.isArray(context.availability) ? context.availability : [];
  const businessName = contextString(company.display_name, contextString(company.domain, "this local service company"));
  const spokenBusinessName = deriveSpokenBusinessName(context);
  const serviceNames = services
    .map((item) => contextString(contextObject(item).name))
    .filter(Boolean)
    .slice(0, 4);
  const companyArea = [contextString(company.city), contextString(company.state_region)].filter(Boolean).join(", ");
  const firstIncludedArea = serviceAreas
    .map(contextObject)
    .find((area) => area.included !== false);
  const fallbackArea = firstIncludedArea
    ? [contextString(firstIncludedArea.city), contextString(firstIncludedArea.state_region)].filter(Boolean).join(", ")
    : "";
  const servicePhrase = serviceNames.length ? serviceNames.join(", ") : "local home services";
  const areaPhrase = companyArea || fallbackArea || "its configured local service area";
  const assistantName = contextString(assistant.name, "Caylee");
  const serviceAreaGuidance = buildServiceAreaGuidance(context);
  const schedulingRule = availability.length
    ? "Use only the loaded availability and never promise an appointment until confirmed."
    : "No live calendar availability is loaded; collect the caller's preferred timing without promising an appointment.";
  const transferRule = settings.allow_transfer === true && contextString(assistant.transfer_phone)
    ? "Transfer only after the caller qualifies and explicitly agrees."
    : "Do not transfer, quote prices, or promise scheduling.";

  return `${businessName} serves ${areaPhrase} for ${servicePhrase}. Its natural spoken name is ${spokenBusinessName}. Answer as the warm phone receptionist for this business. Start with exactly: "Thanks for calling ${spokenBusinessName}, how can I help you today?" Use ${spokenBusinessName} in conversation; do not recite the domain or the longer legal/SEO-style name unless the caller specifically asks. Do not announce internal technology or explain what kind of assistant you are. If asked who you are, say your name is ${assistantName} and that you help with calls and callbacks. ${serviceAreaGuidance} Confirm the service needed, job location, timeline, name, callback number, email, and consent to follow up. ${schedulingRule} ${transferRule}`;
}

export async function syncBlandInboundNumbers(env: RuntimeEnv): Promise<BlandInboundSyncSummary> {
  const response = objectValue(await blandRequest(env, "/v1/inbound"));
  const inboundNumbers = Array.isArray(response?.inbound_numbers) ? response.inbound_numbers : [];
  const summary: BlandInboundSyncSummary = {
    discovered: inboundNumbers.length,
    matched: 0,
    configured: 0,
    unmatched: 0,
    failed: 0,
  };

  for (const value of inboundNumbers) {
    const inbound = objectValue(value);
    const phoneNumber = normalizePhoneNumber(inbound?.phone_number);
    if (!phoneNumber) {
      summary.failed += 1;
      continue;
    }
    try {
      const context = await getBlandVoiceContext(env, phoneNumber, "", null);
      if (context.matched !== true) {
        summary.unmatched += 1;
        continue;
      }
      summary.matched += 1;
      const company = contextObject(context.company);
      const assistant = contextObject(context.assistant);
      const settings = contextObject(assistant.settings);
      if (settings.pilot_scope !== true) {
        summary.unmatched += 1;
        continue;
      }
      const services = Array.isArray(context.services) ? context.services : [];
      const serviceAreas = Array.isArray(context.service_areas) ? context.service_areas : [];
      const availability = Array.isArray(context.availability) ? context.availability : [];
      const pathwayId = contextString(assistant.pathway_id);
      if (!pathwayId) {
        summary.failed += 1;
        continue;
      }

      const baseUrl = contextString(env.PUBLIC_BASE_URL).replace(/\/$/, "");
      const webhook = `${baseUrl}/webhooks/bland/post-call?hook_token=${encodeURIComponent(env.BLAND_WEBHOOK_TOKEN)}`;
      const requestData: Record<string, unknown> = {
        property_key: context.property_key,
        company_display_name: company.display_name,
        assistant_name: assistant.name,
        website_domain: company.domain,
        timezone: company.timezone,
        service_names: services.map((item) => contextString(contextObject(item).name)).filter(Boolean).join(", "),
        service_areas: JSON.stringify(serviceAreas),
        availability: JSON.stringify(availability),
        after_hours_behavior: assistant.after_hours_behavior,
        ai_disclosure: assistant.ai_disclosure,
        transfer_phone: assistant.transfer_phone,
        allow_transfer: settings.allow_transfer === true,
      };
      const update: Record<string, unknown> = {
        pathway_id: pathwayId,
        request_data: requestData,
        metadata: {
          property_key: context.property_key,
          property_id: context.property_id,
          configuration_source: "supabase",
          test_mode: assistant.test_mode !== false,
        },
        webhook,
        record: false,
        max_duration: 15,
      };
      // Voice selection is provider-managed by default so a manual Bland choice
      // (for example Karen) is not silently overwritten by the daily sync.
      // A property can opt back into managed voice IDs explicitly.
      const voiceId = contextString(assistant.voice_id);
      if (voiceId && settings.sync_voice_id === true) update.voice_id = voiceId;
      await blandRequest(env, `/v1/inbound/${encodeURIComponent(phoneNumber)}`, {
        method: "POST",
        body: JSON.stringify(update),
      });
      summary.configured += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

export async function fetchBlandCall(env: RuntimeEnv, callId: string): Promise<Record<string, unknown>> {
  if (!/^[0-9a-f-]{20,80}$/i.test(callId)) throw new Error("invalid_bland_call_id");
  const value = await blandRequest(env, `/v1/calls/${encodeURIComponent(callId)}`);
  const call = objectValue(value);
  if (!call) throw new Error("bland_api_invalid_call");
  return call;
}

export async function syncRecentBlandCalls(env: RuntimeEnv, requestedLimit = 10): Promise<BlandSyncSummary> {
  const limit = Math.max(1, Math.min(10, Math.floor(requestedLimit)));
  const value = await blandRequest(env, `/v1/calls?limit=${limit}&ascending=false`);
  const response = objectValue(value);
  const calls = Array.isArray(response?.calls) ? response.calls : [];
  const summary: BlandSyncSummary = {
    discovered: calls.length,
    processed: 0,
    matched: 0,
    unmatched: 0,
    failed: 0,
  };

  for (const listedCall of calls) {
    const listed = objectValue(listedCall);
    const callId = listed ? getBlandCallId(listed) : "";
    if (!callId) {
      summary.failed += 1;
      continue;
    }
    const requestId = `bland-sync:${callId}`;
    let detail: Record<string, unknown> | null = null;
    try {
      detail = await fetchBlandCall(env, callId);
      await recordBlandWebhookAttempt(env, detail, requestId, "received", "", "historical_sync");
      const result: BlandCallIngestResult = await ingestBlandCall(env, detail, requestId);
      await recordBlandWebhookAttempt(env, detail, requestId, "processed", "", "historical_sync");
      summary.processed += 1;
      if (result.mappingStatus === "matched") summary.matched += 1;
      else summary.unmatched += 1;
    } catch (error) {
      summary.failed += 1;
      if (detail) {
        try {
          await recordBlandWebhookAttempt(
            env,
            detail,
            requestId,
            "rejected",
            error instanceof Error ? error.message : "sync_failed",
            "historical_sync",
          );
        } catch {
          // The primary failure is logged by the caller; do not mask it with an inbox update failure.
        }
      }
    }
  }

  return summary;
}
