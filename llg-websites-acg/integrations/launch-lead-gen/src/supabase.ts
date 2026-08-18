import type { BlandCallIngestResult, CanonicalFilloutSubmission, CanonicalProviderEvent, FilloutIngestResult, PilotSiteConfig, RuntimeEnv, SmsQualificationReply } from "./types";

interface FilloutRpcResponse {
  accepted?: unknown;
  duplicate?: unknown;
  lead_id?: unknown;
  lead_public_id?: unknown;
  property_id?: unknown;
  service_id?: unknown;
  test_mode?: unknown;
}

export async function ingestProviderEvent(env: RuntimeEnv, event: CanonicalProviderEvent): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const { raw_payload: rawPayload, request_id: requestId, kind: _kind, ...contract } = event;
  const value = await callRpc(env, "ingest_provider_event", {
    p_event: contract,
    p_payload: rawPayload,
    p_request_id: requestId,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function recordWebsiteAttributionTouches(
  env: RuntimeEnv,
  leadId: number,
  firstTouch: Record<string, unknown>,
  lastTouch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "record_website_attribution_touches", {
    p_lead_id: leadId,
    p_first_touch: firstTouch,
    p_last_touch: lastTouch,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function upsertPortfolioAdMetric(env: RuntimeEnv, metric: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "upsert_portfolio_ad_metric", { p_metric: metric, p_ingest_token: env.SUPABASE_INGEST_TOKEN });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function recordIntegrationSyncRun(env: RuntimeEnv, run: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "record_integration_sync_run", { p_run: run, p_ingest_token: env.SUPABASE_INGEST_TOKEN });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function getDrainscapesControllerState(env: RuntimeEnv): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "get_drainscapes_controller_state", { p_ingest_token: env.SUPABASE_INGEST_TOKEN });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function recordDrainscapesAllocationRun(
  env: RuntimeEnv,
  run: Record<string, unknown>,
  markets: Record<string, unknown>[],
): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "record_drainscapes_allocation_run", {
    p_run: run,
    p_markets: markets,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function recordDrainscapesDailyReport(env: RuntimeEnv, report: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "record_drainscapes_daily_report", {
    p_report: report,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function prepareBlandCallCorrelation(env: RuntimeEnv, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "prepare_bland_call_correlation", { p_payload: payload, p_ingest_token: env.SUPABASE_INGEST_TOKEN });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

async function callRpc(env: RuntimeEnv, functionName: string, body: Record<string, unknown>): Promise<unknown> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error("supabase_not_configured");
  const endpoint = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      "content-type": "application/json",
      "x-client-info": "llg-cloudflare-intake/1.0",
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    const detail = responseBody.replace(/\s+/g, " ").slice(0, 500);
    throw new Error(`supabase_rpc_${functionName}_${response.status}:${detail}`);
  }
  try {
    return JSON.parse(responseBody);
  } catch {
    throw new Error(`supabase_rpc_${functionName}_invalid_response`);
  }
}

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function recordBlandWebhookAttempt(
  env: RuntimeEnv,
  payload: Record<string, unknown>,
  requestId: string,
  status: "received" | "processed" | "rejected",
  errorMessage = "",
  eventType = "post_call",
): Promise<void> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  await callRpc(env, "record_bland_webhook_attempt", {
    p_payload: payload,
    p_request_id: requestId,
    p_ingest_token: env.BLAND_INGEST_TOKEN,
    p_status: status,
    p_error_message: errorMessage,
    p_event_type: eventType,
  });
}

export async function getBlandVoiceContext(
  env: RuntimeEnv,
  phoneNumber: string,
  propertyKey: string,
  leadPublicId: string | null,
): Promise<Record<string, unknown>> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  const value = await callRpc(env, "get_bland_voice_context", {
    p_phone_number: phoneNumber || null,
    p_property_key: propertyKey || null,
    p_lead_public_id: leadPublicId,
    p_ingest_token: env.BLAND_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function recordCallRailPreCallContext(
  env: RuntimeEnv,
  payload: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown>> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  const value = await callRpc(env, "ingest_callrail_precall_context", {
    p_payload: payload,
    p_request_id: requestId,
    p_ingest_token: env.BLAND_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function getRecentCallRailVoiceContext(
  env: RuntimeEnv,
  callerPhone: string,
): Promise<Record<string, unknown>> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  const value = await callRpc(env, "get_recent_callrail_voice_context", {
    p_caller_phone: callerPhone,
    p_ingest_token: env.BLAND_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function checkPropertyServiceArea(
  env: RuntimeEnv,
  propertyKey: string,
  location: {
    city: string;
    stateRegion: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
  },
): Promise<Record<string, unknown>> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  const value = await callRpc(env, "check_property_service_area", {
    p_property_key: propertyKey,
    p_city: location.city || null,
    p_state_region: location.stateRegion || null,
    p_postal_code: location.postalCode || null,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_ingest_token: env.BLAND_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function ingestBlandCall(
  env: RuntimeEnv,
  payload: Record<string, unknown>,
  requestId: string,
): Promise<BlandCallIngestResult> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  const value = await callRpc(env, "ingest_bland_call", {
    p_payload: payload,
    p_request_id: requestId,
    p_ingest_token: env.BLAND_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  const result = value as Record<string, unknown>;
  const voiceCallId = nullableInteger(result.voice_call_id);
  const externalCallId = typeof result.external_call_id === "string" ? result.external_call_id : "";
  const mappingStatus = result.mapping_status;
  if (!voiceCallId || !externalCallId || !["matched", "unmatched", "ambiguous"].includes(String(mappingStatus))) {
    throw new Error("supabase_invalid_response");
  }
  return {
    accepted: result.accepted === true,
    voiceCallId,
    externalCallId,
    propertyId: nullableInteger(result.property_id),
    leadId: nullableInteger(result.lead_id),
    mappingStatus: mappingStatus as BlandCallIngestResult["mappingStatus"],
    testMode: result.test_mode === true,
  };
}

export async function syncCallRailTrackerInventory(
  env: RuntimeEnv,
  trackers: Record<string, unknown>[],
): Promise<Record<string, number>> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  const value = await callRpc(env, "sync_callrail_tracker_inventory", {
    p_trackers: trackers,
    p_ingest_token: env.BLAND_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  const result = value as Record<string, unknown>;
  return {
    trackersUpserted: Number(result.trackers_upserted) || 0,
    numbersSeen: Number(result.numbers_seen) || 0,
    numbersMatched: Number(result.numbers_matched) || 0,
    numbersUnmatched: Number(result.numbers_unmatched) || 0,
    numberConflicts: Number(result.number_conflicts) || 0,
  };
}

export async function resolveCallRailCompanyPhoneNumbers(env: RuntimeEnv): Promise<number> {
  if (!env.BLAND_INGEST_TOKEN) throw new Error("missing_secret:BLAND_INGEST_TOKEN");
  const value = await callRpc(env, "resolve_callrail_company_phone_numbers", {
    p_ingest_token: env.BLAND_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return Number((value as Record<string, unknown>).numbers_inserted) || 0;
}

export async function recordFilloutWebhookAttempt(
  env: RuntimeEnv,
  formId: string,
  payload: Record<string, unknown>,
  requestId: string,
  status: "received" | "processed" | "rejected",
  errorMessage = "",
): Promise<void> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  await callRpc(env, "record_fillout_webhook_attempt", {
    p_form_id: formId,
    p_payload: payload,
    p_request_id: requestId,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
    p_status: status,
    p_error_message: errorMessage,
  });
}

function parseResult(value: unknown): FilloutIngestResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  const result = value as FilloutRpcResponse;
  const leadId = Number(result.lead_id);
  const propertyId = Number(result.property_id);
  const serviceId = Number(result.service_id);
  const leadPublicId = typeof result.lead_public_id === "string" ? result.lead_public_id : "";
  if (!Number.isInteger(leadId) || !Number.isInteger(propertyId) || !Number.isInteger(serviceId) || !leadPublicId) {
    throw new Error("supabase_invalid_response");
  }
  return {
    accepted: result.accepted === true,
    duplicate: result.duplicate === true,
    leadId,
    leadPublicId,
    propertyId,
    serviceId,
    testMode: result.test_mode === true,
  };
}

export async function ingestFilloutSubmission(
  env: RuntimeEnv,
  formId: string,
  submission: CanonicalFilloutSubmission,
  rawPayload: Record<string, unknown>,
  requestId: string,
): Promise<FilloutIngestResult> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const parsed = await callRpc(env, "ingest_fillout_submission", {
    p_form_id: formId,
    p_submission: submission,
    p_payload: rawPayload,
    p_request_id: requestId,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  return parseResult(parsed);
}

export async function getPilotSiteConfig(env: RuntimeEnv, siteKey: string): Promise<PilotSiteConfig | null> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "get_pilot_site_config", {
    p_site_key: siteKey,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  const config = value as Record<string, unknown>;
  const form = config.form;
  if (typeof config.property_key !== "string" || typeof config.domain !== "string"
    || !form || typeof form !== "object" || Array.isArray(form)
    || typeof (form as Record<string, unknown>).form_id !== "string"
    || typeof config.sms_phone !== "string"
    || typeof config.sms_enabled !== "boolean") {
    throw new Error("supabase_invalid_response");
  }
  return value as PilotSiteConfig;
}

export async function ingestTextMagicEvent(
  env: RuntimeEnv,
  eventType: "inbound" | "delivery",
  payload: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "ingest_textmagic_event", {
    p_event_type: eventType,
    p_payload: payload,
    p_request_id: requestId,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

export async function ingestCallRailSmsEvent(
  env: RuntimeEnv,
  eventType: "text_received" | "text_sent",
  payload: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown>> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "ingest_callrail_sms_event", {
    p_event_type: eventType,
    p_payload: payload,
    p_request_id: requestId,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  return value as Record<string, unknown>;
}

function parseSmsQualificationReply(value: unknown): SmsQualificationReply {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("supabase_invalid_response");
  const result = value as Record<string, unknown>;
  return {
    shouldSend: result.should_send === true,
    reason: typeof result.reason === "string" ? result.reason : undefined,
    sessionId: nullableInteger(result.session_id),
    propertyId: nullableInteger(result.property_id),
    leadId: nullableInteger(result.lead_id),
    toPhone: typeof result.to_phone === "string" ? result.to_phone : "",
    fromPhone: typeof result.from_phone === "string" ? result.from_phone : "",
    message: typeof result.message === "string" ? result.message : "",
    status: typeof result.status === "string" ? result.status : "",
    step: Number.isInteger(Number(result.step)) ? Number(result.step) : 0,
  };
}

export async function prepareSmsQualificationReply(
  env: RuntimeEnv,
  sourceProviderKey: "callrail" | "textmagic",
  externalMessageId: string,
): Promise<SmsQualificationReply> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "prepare_sms_qualification_reply", {
    p_source_provider_key: sourceProviderKey,
    p_external_message_id: externalMessageId,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  return parseSmsQualificationReply(value);
}

export async function startSmsQualification(
  env: RuntimeEnv,
  propertyKey: string,
  contactPhone: string,
  leadId: number | null,
): Promise<SmsQualificationReply> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  const value = await callRpc(env, "start_sms_qualification", {
    p_property_key: propertyKey,
    p_contact_phone: contactPhone,
    p_lead_id: leadId,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
  return parseSmsQualificationReply(value);
}

export async function recordTextMagicOutbound(
  env: RuntimeEnv,
  externalMessageId: string,
  reply: SmsQualificationReply,
  providerResponse: Record<string, unknown>,
): Promise<void> {
  if (!env.SUPABASE_INGEST_TOKEN) throw new Error("missing_secret:SUPABASE_INGEST_TOKEN");
  if (!reply.propertyId || !reply.sessionId) throw new Error("missing_sms_qualification_context");
  await callRpc(env, "record_textmagic_outbound", {
    p_external_message_id: externalMessageId,
    p_property_id: reply.propertyId,
    p_lead_id: reply.leadId,
    p_from_phone: reply.fromPhone,
    p_to_phone: reply.toPhone,
    p_message_body: reply.message,
    p_session_id: reply.sessionId,
    p_provider_response: providerResponse,
    p_ingest_token: env.SUPABASE_INGEST_TOKEN,
  });
}
