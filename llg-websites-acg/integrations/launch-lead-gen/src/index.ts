import { canonicalCallRailEvent, canonicalFilloutEvent } from "./canonical";
import { parseFilloutSubmission } from "./fillout";
import { buildTriageContext, getBlandCallId, isBlandLiveEventPayload, parseBlandContextRequest, resolveBlandVoiceContext, syncBlandInboundNumbers, syncRecentBlandCalls } from "./bland";
import { syncCallRailPhoneInventory } from "./callrail-inventory";
import { normalizeMetaNotification } from "./normalize";
import { fetchMetaLead, syncGoogleAds, syncMetaAds } from "./platforms";
import { runDrainscapesDemandController } from "./drainscapes";
import { constantTimeEqual, isFreshTimestamp, readBoundedBody, secureTokenEqual, verifyBlandWebhookSignature, verifyCallRailSignatures, verifyMetaSignature } from "./security";
import {
  getPilotSiteConfig,
  checkPropertyServiceArea,
  ingestBlandCall,
  ingestCallRailSmsEvent,
  ingestProviderEvent,
  ingestTextMagicEvent,
  prepareSmsQualificationReply,
  recordCallRailPreCallContext,
  recordTextMagicOutbound,
  recordBlandWebhookAttempt,
  recordFilloutWebhookAttempt,
  recordWebsiteAttributionTouches,
  prepareBlandCallCorrelation,
  startSmsQualification,
} from "./supabase";
import type { IntegrationMessage, RuntimeEnv, SmsQualificationReply } from "./types";
import { pilotSiteCss, pilotSiteHtml, pilotSiteScript } from "./pilot-site";
import { websiteEmbedScript } from "./widget";
import { websiteTextWidgetScript } from "./text-widget";
import { getTextMagicMessageId, parseTextMagicCallback, sendTextMagicMessage } from "./textmagic";
import { canonicalWebsiteLead, canonicalWebsiteTextStart, isProductionWebsiteOrigin, verifyWebsiteTurnstile, websiteCorsOrigin } from "./website-lead";

export { RouteSequencer } from "./route-sequencer";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function publicJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": status === 200 ? "public, max-age=300" : "no-store",
    },
  });
}

function websiteJson(body: unknown, status: number, origin: string): Response {
  return Response.json(body, {
    status,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
      "vary": "Origin",
    },
  });
}

function authorized(request: Request, env: RuntimeEnv): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(env.ADMIN_SYNC_TOKEN) && constantTimeEqual(supplied, env.ADMIN_SYNC_TOKEN);
}

const DELIVERY_ENABLED = false;

function featureEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

async function parseJson(raw: ArrayBuffer): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(new TextDecoder().decode(raw));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_json_object");
  return value as Record<string, unknown>;
}

async function handleCallRail(request: Request, env: RuntimeEnv): Promise<Response> {
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  const signingKeys = [
    env.CALLRAIL_SIGNING_KEY,
    ...(env.CALLRAIL_SIGNING_KEYS ?? "").split(","),
  ];
  if (!(await verifyCallRailSignatures(raw, request.headers.get("Signature"), signingKeys))) {
    return json({ ok: false, error: "invalid_signature" }, 401);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!isFreshTimestamp(payload.timestamp)) return json({ ok: false, error: "stale_or_missing_timestamp" }, 401);
  const receivedAt = new Date().toISOString();
  const eventType = new URL(request.url).searchParams.get("event") || "call";
  try {
    if (eventType === "pre_call") {
      const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
      const result = await recordCallRailPreCallContext(env, payload, requestId);
      console.log(JSON.stringify({ event: "callrail_precall_context_recorded", requestId, result }));
      return json({ ok: true, accepted: 1, requestId, matched: result.matched === true }, 202);
    }
    if (eventType === "text_received" || eventType === "text_sent") {
      const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
      const result = await ingestCallRailSmsEvent(env, eventType, payload, requestId);
      console.log(JSON.stringify({ event: "callrail_sms_ingested", eventType, requestId, deliveryEnabled: false, result }));
      return json({ ok: true, accepted: 1, deliveryEnabled: false, requestId }, 202);
    }
    const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
    const message = canonicalCallRailEvent(payload, eventType, receivedAt, requestId, env.DRY_RUN === "true");
    await env.EVENTS_QUEUE.send(message);
    console.log(JSON.stringify({ event: "callrail_accepted", eventType, providerEventId: message.provider_event_id, requestId }));
    return json({ ok: true, accepted: 1, requestId }, 202);
  } catch (error) {
    console.warn(JSON.stringify({ event: "callrail_rejected", reason: error instanceof Error ? error.message : "invalid_payload" }));
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
}

async function handleMeta(request: Request, env: RuntimeEnv): Promise<Response> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode") ?? "";
    const supplied = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && env.META_VERIFY_TOKEN && constantTimeEqual(supplied, env.META_VERIFY_TOKEN)) {
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
    }
    return json({ ok: false, error: "verification_failed" }, 403);
  }

  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  if (!(await verifyMetaSignature(raw, request.headers.get("X-Hub-Signature-256"), env.META_APP_SECRET))) {
    return json({ ok: false, error: "invalid_signature" }, 401);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const messages = normalizeMetaNotification(payload);
  if (!messages.length) return json({ ok: true, accepted: 0 }, 202);
  await env.EVENTS_QUEUE.sendBatch(messages.map((body) => ({ body })));
  console.log(JSON.stringify({ event: "meta_accepted", count: messages.length }));
  return json({ ok: true, accepted: messages.length }, 202);
}

async function handleFillout(request: Request, env: RuntimeEnv, formId: string): Promise<Response> {
  const url = new URL(request.url);
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("hook_token") || "";
  if (!env.FILLOUT_WEBHOOK_TOKEN || !(await secureTokenEqual(supplied, env.FILLOUT_WEBHOOK_TOKEN))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  try {
    await recordFilloutWebhookAttempt(env, formId, payload, requestId, "received");
  } catch {
    console.error(JSON.stringify({ event: "fillout_inbox_failed", requestId, formId }));
    return json({ ok: false, error: "inbox_unavailable", requestId }, 503);
  }

  try {
    const submission = parseFilloutSubmission(payload, receivedAt);
    const event = canonicalFilloutEvent(formId, submission, payload, requestId, env.DRY_RUN === "true");
    const result = await ingestProviderEvent(env, event);
    await recordFilloutWebhookAttempt(env, formId, payload, requestId, "processed");
    console.log(JSON.stringify({
      event: "fillout_ingested",
      requestId,
      formId,
      submissionId: submission.submissionId,
      leadId: result.lead_id,
      propertyId: result.property_id,
      duplicate: result.duplicate,
      testMode: result.test_mode,
      mappingStatus: result.mapping_status,
    }));
    return json({ ok: true, accepted: result.accepted, duplicate: result.duplicate, deliveryEnabled: false, requestId }, 202);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid_payload";
    try {
      await recordFilloutWebhookAttempt(env, formId, payload, requestId, "rejected", reason);
    } catch {
      console.error(JSON.stringify({ event: "fillout_inbox_update_failed", requestId, formId }));
    }
    const clientError = ["invalid_fillout_payload", "missing_submission_id", "missing_site_key", "missing_required_contact_fields", "contact_consent_required"].includes(reason);
    console.warn(JSON.stringify({ event: "fillout_rejected", requestId, formId, reason }));
    return json({ ok: false, error: clientError ? reason : "ingestion_failed", requestId }, clientError ? 400 : 503);
  }
}

async function handleWebsiteLead(request: Request, env: RuntimeEnv): Promise<Response> {
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    const origin = websiteCorsOrigin(request) || "null";
    return websiteJson({ ok: false, error: "payload_too_large" }, 413, origin);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    const origin = websiteCorsOrigin(request) || "null";
    return websiteJson({ ok: false, error: "invalid_json" }, 400, origin);
  }
  const siteKey = typeof payload.siteKey === "string" ? payload.siteKey.trim().toLowerCase() : "";
  const origin = websiteCorsOrigin(request, siteKey);
  if (!origin) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (typeof payload.company === "string" && payload.company.trim()) {
    return websiteJson({ ok: true, accepted: true, leadId: payload.submissionId || crypto.randomUUID() }, 202, origin);
  }
  const token = typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";
  const turnstileOk = await verifyWebsiteTurnstile(env, token, request.headers.get("cf-connecting-ip"), siteKey, origin);
  if (!turnstileOk) return websiteJson({ ok: false, error: "turnstile_failed", message: "Please complete the security check and try again." }, 400, origin);
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  try {
    const productionOriginEnabled = env.WEBSITE_PRODUCTION_ORIGINS_ENABLED === "true";
    const testMode = !(productionOriginEnabled && isProductionWebsiteOrigin(origin, siteKey));
    const event = canonicalWebsiteLead(payload, requestId, new Date().toISOString(), testMode);
    const result = await ingestProviderEvent(env, event);
    const numericLeadId = Number(result.lead_id);
    if (result.accepted === true && Number.isInteger(numericLeadId) && numericLeadId > 0) {
      const firstTouch = payload.firstTouch && typeof payload.firstTouch === "object" && !Array.isArray(payload.firstTouch)
        ? payload.firstTouch as Record<string, unknown> : {};
      const lastTouch = payload.lastTouch && typeof payload.lastTouch === "object" && !Array.isArray(payload.lastTouch)
        ? payload.lastTouch as Record<string, unknown> : {};
      await recordWebsiteAttributionTouches(env, numericLeadId, firstTouch, lastTouch);
    }
    const leadId = typeof result.lead_public_id === "string" ? result.lead_public_id : event.provider_event_id;
    console.log(JSON.stringify({ event: "website_lead_ingested", siteKey, requestId, accepted: result.accepted === true, duplicate: result.duplicate === true }));
    return websiteJson({ ok: true, accepted: result.accepted !== false, duplicate: result.duplicate === true, leadId, requestId }, 202, origin);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid_payload";
    const clientError = ["unknown_site", "missing_required_fields", "invalid_email", "invalid_phone", "invalid_zip"].includes(reason);
    console.warn(JSON.stringify({ event: "website_lead_rejected", siteKey, requestId, reason }));
    return websiteJson({
      ok: false,
      error: clientError ? reason : "ingestion_failed",
      message: clientError ? "Please check the form fields and try again." : "We could not send the request. Please try again.",
    }, clientError ? 400 : 503, origin);
  }
}

async function sendQualificationReply(env: RuntimeEnv, reply: SmsQualificationReply): Promise<string | null> {
  if (!reply.shouldSend) return null;
  if (!featureEnabled(env.TEXTMAGIC_DELIVERY_ENABLED)) throw new Error("textmagic_delivery_disabled");
  if (!reply.toPhone || !reply.message) throw new Error("invalid_sms_qualification_reply");
  const providerResponse = await sendTextMagicMessage(env, reply.toPhone, reply.message, reply.fromPhone);
  const externalMessageId = getTextMagicMessageId(providerResponse);
  await recordTextMagicOutbound(env, externalMessageId, reply, providerResponse);
  return externalMessageId;
}

async function handleWebsiteTextStart(request: Request, env: RuntimeEnv): Promise<Response> {
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    const origin = websiteCorsOrigin(request) || "null";
    return websiteJson({ ok: false, error: "payload_too_large" }, 413, origin);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    const origin = websiteCorsOrigin(request) || "null";
    return websiteJson({ ok: false, error: "invalid_json" }, 400, origin);
  }
  const siteKey = typeof payload.siteKey === "string" ? payload.siteKey.trim().toLowerCase() : "";
  const origin = websiteCorsOrigin(request, siteKey);
  if (!origin) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (typeof payload.company === "string" && payload.company.trim()) {
    return websiteJson({ ok: true, accepted: true, leadId: payload.submissionId || crypto.randomUUID() }, 202, origin);
  }
  if (!featureEnabled(env.TEXTMAGIC_DELIVERY_ENABLED)) {
    return websiteJson({ ok: false, error: "texting_unavailable", message: "Texting is temporarily unavailable. Please use the main request form." }, 503, origin);
  }
  const token = typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";
  const turnstileOk = await verifyWebsiteTurnstile(env, token, request.headers.get("cf-connecting-ip"), siteKey, origin);
  if (!turnstileOk) return websiteJson({ ok: false, error: "turnstile_failed", message: "Please complete the security check and try again." }, 400, origin);
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  try {
    const productionOriginEnabled = env.WEBSITE_PRODUCTION_ORIGINS_ENABLED === "true";
    const testMode = !(productionOriginEnabled && isProductionWebsiteOrigin(origin, siteKey));
    const event = canonicalWebsiteTextStart(payload, requestId, new Date().toISOString(), testMode);
    const result = await ingestProviderEvent(env, event);
    const numericLeadId = Number(result.lead_id);
    const leadId = Number.isInteger(numericLeadId) && numericLeadId > 0 ? numericLeadId : null;
    if (result.accepted === true && leadId) {
      const firstTouch = payload.firstTouch && typeof payload.firstTouch === "object" && !Array.isArray(payload.firstTouch)
        ? payload.firstTouch as Record<string, unknown> : {};
      const lastTouch = payload.lastTouch && typeof payload.lastTouch === "object" && !Array.isArray(payload.lastTouch)
        ? payload.lastTouch as Record<string, unknown> : {};
      await recordWebsiteAttributionTouches(env, leadId, firstTouch, lastTouch);
    }
    const propertyKey = event.property_key;
    const phone = typeof event.contact.normalized_phone === "string" ? event.contact.normalized_phone : "";
    if (!propertyKey || !phone) throw new Error("missing_text_start_context");
    const reply = await startSmsQualification(env, propertyKey, phone, leadId);
    const firstName = typeof event.contact.first_name === "string" ? event.contact.first_name : "there";
    const requestedService = typeof event.service.requested === "string" ? event.service.requested : "your project";
    const personalizedReply = reply.shouldSend
      ? { ...reply, message: `Hi ${firstName}, thanks for reaching out about ${requestedService}. ${reply.message}`.trim() }
      : reply;
    const externalMessageId = await sendQualificationReply(env, personalizedReply);
    if (!externalMessageId) throw new Error(reply.reason || "sms_flow_unavailable");
    const publicLeadId = typeof result.lead_public_id === "string" ? result.lead_public_id : event.provider_event_id;
    console.log(JSON.stringify({ event: "website_text_started", siteKey, requestId, leadId: publicLeadId, externalMessageId, testMode }));
    return websiteJson({ ok: true, accepted: true, leadId: publicLeadId, smsStarted: true, requestId }, 202, origin);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "text_start_failed";
    const clientError = ["unknown_site", "missing_required_fields", "invalid_phone", "invalid_zip", "sms_consent_required"].includes(reason);
    console.error(JSON.stringify({ event: "website_text_start_failed", siteKey, requestId, reason }));
    return websiteJson({
      ok: false,
      error: clientError ? reason : "text_start_failed",
      message: clientError ? "Please check the form fields and consent box." : "We couldn't start the text. Please try again or use the main request form.",
    }, clientError ? 400 : 503, origin);
  }
}

async function handleTextMagicWebhook(
  request: Request,
  env: RuntimeEnv,
  eventType: "inbound" | "delivery",
  pathToken = "",
): Promise<Response> {
  const url = new URL(request.url);
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    || url.searchParams.get("hook_token")
    || pathToken
    || "";
  if (!env.TEXTMAGIC_WEBHOOK_TOKEN || !(await secureTokenEqual(supplied, env.TEXTMAGIC_WEBHOOK_TOKEN))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseTextMagicCallback(raw, request.headers.get("content-type") || "");
  } catch {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  try {
    const result = await ingestTextMagicEvent(env, eventType, payload, requestId);
    let replyMessageId: string | null = null;
    if (eventType === "inbound" && featureEnabled(env.TEXTMAGIC_DELIVERY_ENABLED)) {
      const externalMessageId = typeof result.external_message_id === "string" ? result.external_message_id : "";
      if (externalMessageId) {
        const reply = await prepareSmsQualificationReply(env, "textmagic", externalMessageId);
        replyMessageId = await sendQualificationReply(env, reply);
      }
    }
    const deliveryEnabled = featureEnabled(env.TEXTMAGIC_DELIVERY_ENABLED);
    console.log(JSON.stringify({ event: "textmagic_ingested", eventType, requestId, deliveryEnabled, replyMessageId, result }));
    return json({ ok: true, accepted: true, deliveryEnabled, replySent: Boolean(replyMessageId), requestId }, 202);
  } catch (error) {
    console.error(JSON.stringify({
      event: "textmagic_ingest_failed",
      eventType,
      requestId,
      reason: error instanceof Error ? error.message : "unknown",
    }));
    return json({ ok: false, error: "ingestion_failed", requestId }, 503);
  }
}

async function handleTextMagicSend(request: Request, env: RuntimeEnv): Promise<Response> {
  void request;
  void env;
  return json({ ok: false, error: "delivery_disabled", deliveryEnabled: false }, 423);
}

async function handleSiteConfig(request: Request, env: RuntimeEnv): Promise<Response> {
  const siteKey = new URL(request.url).searchParams.get("site_key")?.trim() || "";
  if (!/^domain:[a-z0-9.-]{4,253}$/i.test(siteKey)) return publicJson({ ok: false, error: "invalid_site_key" }, 400);
  try {
    const config = await getPilotSiteConfig(env, siteKey.toLowerCase());
    if (!config) return publicJson({ ok: false, error: "site_not_in_pilot" }, 404);
    return publicJson(config);
  } catch (error) {
    console.error(JSON.stringify({ event: "site_config_failed", siteKey, reason: error instanceof Error ? error.message : "unknown" }));
    return publicJson({ ok: false, error: "configuration_unavailable" }, 503);
  }
}

function handleWebsiteEmbed(): Response {
  return new Response(websiteEmbedScript(), {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
      "content-type": "application/javascript; charset=utf-8",
      "cross-origin-resource-policy": "cross-origin",
      "x-content-type-options": "nosniff",
    },
  });
}

function handleTextWidgetEmbed(): Response {
  return new Response(websiteTextWidgetScript(), {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
      "content-type": "application/javascript; charset=utf-8",
      "cross-origin-resource-policy": "cross-origin",
      "x-content-type-options": "nosniff",
    },
  });
}

function pilotAsset(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    },
  });
}

async function handlePilotSite(env: RuntimeEnv, domain: string): Promise<Response> {
  const siteKey = `domain:${domain.toLowerCase()}`;
  try {
    const config = await getPilotSiteConfig(env, siteKey);
    if (!config) return json({ ok: false, error: "site_not_in_pilot" }, 404);
    return new Response(pilotSiteHtml(config, config.sms_enabled), {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "pilot_site_failed", siteKey, reason: error instanceof Error ? error.message : "unknown" }));
    return json({ ok: false, error: "site_unavailable" }, 503);
  }
}

async function blandWebhookAuthorized(request: Request, env: RuntimeEnv): Promise<boolean> {
  const url = new URL(request.url);
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    || url.searchParams.get("hook_token")
    || "";
  return Boolean(env.BLAND_WEBHOOK_TOKEN) && secureTokenEqual(supplied, env.BLAND_WEBHOOK_TOKEN);
}

async function blandSyncAuthorized(request: Request, env: RuntimeEnv): Promise<boolean> {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(env.BLAND_SYNC_TOKEN) && secureTokenEqual(supplied, env.BLAND_SYNC_TOKEN);
}

async function handleBlandPostCall(request: Request, env: RuntimeEnv): Promise<Response> {
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  const tokenAuthorized = await blandWebhookAuthorized(request, env);
  const signatureAuthorized = await verifyBlandWebhookSignature(
    raw,
    request.headers.get("X-Webhook-Signature"),
    env.BLAND_WEBHOOK_SIGNING_SECRET,
  );
  if (!tokenAuthorized && !signatureAuthorized) return json({ ok: false, error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const callId = getBlandCallId(payload);
  const requestId = request.headers.get("cf-ray") || (callId ? `bland-webhook:${callId}:${crypto.randomUUID()}` : crypto.randomUUID());
  if (isBlandLiveEventPayload(payload)) {
    try {
      await recordBlandWebhookAttempt(env, payload, requestId, "processed", "", "live_event_ignored");
    } catch {
      console.error(JSON.stringify({ event: "bland_live_event_inbox_failed", requestId, callId }));
      return json({ ok: false, error: "inbox_unavailable", requestId }, 503);
    }
    return json({ ok: true, accepted: false, ignored: true, requestId }, 202);
  }
  try {
    await recordBlandWebhookAttempt(env, payload, requestId, "received");
  } catch {
    console.error(JSON.stringify({ event: "bland_inbox_failed", requestId, callId }));
    return json({ ok: false, error: "inbox_unavailable", requestId }, 503);
  }

  try {
    const correlatedPayload = await prepareBlandCallCorrelation(env, payload);
    const result = await ingestBlandCall(env, correlatedPayload, requestId);
    await recordBlandWebhookAttempt(env, correlatedPayload, requestId, "processed");
    console.log(JSON.stringify({
      event: "bland_call_ingested",
      requestId,
      callId: result.externalCallId,
      voiceCallId: result.voiceCallId,
      propertyId: result.propertyId,
      leadId: result.leadId,
      mappingStatus: result.mappingStatus,
      testMode: result.testMode,
    }));
    return json({ ok: true, accepted: result.accepted, mappingStatus: result.mappingStatus, requestId }, 202);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "ingestion_failed";
    try {
      await recordBlandWebhookAttempt(env, payload, requestId, "rejected", reason);
    } catch {
      console.error(JSON.stringify({ event: "bland_inbox_update_failed", requestId, callId }));
    }
    console.warn(JSON.stringify({ event: "bland_call_rejected", requestId, callId, reason }));
    return json({ ok: false, error: "ingestion_failed", requestId }, 503);
  }
}

async function handleBlandContext(request: Request, env: RuntimeEnv): Promise<Response> {
  if (!(await blandWebhookAuthorized(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = parseBlandContextRequest(payload);
  if (!parsed.phoneNumber && !parsed.propertyKey) {
    return json({ ok: false, error: "phone_number_or_property_key_required" }, 400);
  }
  try {
    const context = await resolveBlandVoiceContext(env, parsed);
    return json(context);
  } catch (error) {
    console.error(JSON.stringify({ event: "bland_context_failed", reason: error instanceof Error ? error.message : "unknown" }));
    return json({ ok: false, error: "context_unavailable" }, 503);
  }
}

async function handleVoiceTriageLookup(request: Request, env: RuntimeEnv): Promise<Response> {
  if (!(await blandWebhookAuthorized(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = parseBlandContextRequest(payload);
  if (!parsed.phoneNumber) return json({ ok: false, error: "dialed_number_required" }, 400);

  try {
    const context = await resolveBlandVoiceContext(env, parsed, "", null);
    const triageContext = buildTriageContext(context);
    if (!triageContext) {
      console.warn(JSON.stringify({ event: "voice_triage_unmatched", dialedNumber: parsed.phoneNumber }));
      return json({
        matched: false,
        triage_context: "The business identity for this inbound call could not be verified. Do not claim a company identity or service availability. Apologize, collect the caller's name, callback number, and reason for calling, then end the call without transferring or making promises.",
      });
    }
    return json({
      matched: true,
      property_key: context.property_key,
      test_mode: true,
      triage_context: triageContext,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "voice_triage_failed", reason: error instanceof Error ? error.message : "unknown" }));
    return json({ ok: false, error: "context_unavailable" }, 503);
  }
}

function payloadText(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function payloadCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function handleVoiceServiceAreaCheck(request: Request, env: RuntimeEnv): Promise<Response> {
  if (!(await blandWebhookAuthorized(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
  let raw: ArrayBuffer;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }
  let payload: Record<string, unknown>;
  try {
    payload = await parseJson(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const parsed = parseBlandContextRequest(payload);
  if (!parsed.phoneNumber && !parsed.propertyKey) {
    return json({ ok: false, error: "phone_number_or_property_key_required" }, 400);
  }
  const city = payloadText(payload, "city", "project_city");
  const stateRegion = payloadText(payload, "state_region", "state", "project_state");
  const postalCode = payloadText(payload, "postal_code", "zip", "zip_code", "project_zip");
  if (!city && !postalCode && (payload.latitude === undefined || payload.longitude === undefined)) {
    return json({ ok: false, error: "project_location_required" }, 400);
  }

  try {
    const context = await resolveBlandVoiceContext(env, parsed);
    if (context.matched !== true || typeof context.property_key !== "string") {
      return json({ ok: false, error: "property_not_resolved" }, 404);
    }
    const result = await checkPropertyServiceArea(env, context.property_key, {
      city,
      stateRegion,
      postalCode,
      latitude: payloadCoordinate(payload.latitude),
      longitude: payloadCoordinate(payload.longitude),
    });
    return json({ ok: true, property_key: context.property_key, ...result });
  } catch (error) {
    console.error(JSON.stringify({ event: "voice_service_area_check_failed", reason: error instanceof Error ? error.message : "unknown" }));
    return json({ ok: false, error: "service_area_unavailable" }, 503);
  }
}

async function runSync(source: "google-ads" | "meta-ads", env: RuntimeEnv): Promise<Response> {
  const summary = source === "google-ads" ? await syncGoogleAds(env) : await syncMetaAds(env);
  return json({ ok: true, dryRun: env.DRY_RUN === "true", summary }, 202);
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && (url.pathname === "/v1/website-leads" || url.pathname === "/v1/website-text-starts")) {
      const origin = websiteCorsOrigin(request);
      if (!origin) return json({ ok: false, error: "origin_not_allowed" }, 403);
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        "vary": "Origin",
      } });
    }
    if (request.method === "POST" && url.pathname === "/v1/website-leads") return handleWebsiteLead(request, env);
    if (request.method === "POST" && url.pathname === "/v1/website-text-starts") return handleWebsiteTextStart(request, env);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "launch-lead-gen-integrations", environment: env.ENVIRONMENT, dryRun: env.DRY_RUN === "true",
        sourceOfRecord: "supabase", deliveryEnabled: DELIVERY_ENABLED });
    }
    if (request.method === "GET" && url.pathname === "/sites/config") return handleSiteConfig(request, env);
    if (request.method === "GET" && url.pathname === "/embed/llg.js") return handleWebsiteEmbed();
    if (request.method === "GET" && url.pathname === "/embed/text-widget.js") return handleTextWidgetEmbed();
    if (request.method === "GET" && url.pathname === "/pilot/site.css") return pilotAsset(pilotSiteCss(), "text/css; charset=utf-8");
    if (request.method === "GET" && url.pathname === "/pilot/site.js") return pilotAsset(pilotSiteScript(), "application/javascript; charset=utf-8");
    const pilotMatch = request.method === "GET" ? url.pathname.match(/^\/pilot\/([a-z0-9.-]{4,253})$/i) : null;
    if (pilotMatch?.[1]) return handlePilotSite(env, pilotMatch[1]);
    if (request.method === "POST" && url.pathname === "/webhooks/callrail") return handleCallRail(request, env);
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/webhooks/meta") return handleMeta(request, env);
    const filloutMatch = request.method === "POST" ? url.pathname.match(/^\/webhooks\/fillout\/([A-Za-z0-9_-]{3,100})$/) : null;
    if (filloutMatch?.[1]) return handleFillout(request, env, filloutMatch[1]);
    const textMagicMatch = url.pathname.match(/^\/webhooks\/textmagic\/(inbound|delivery)\/([A-Za-z0-9-]{32,128})$/);
    if (textMagicMatch?.[1] && textMagicMatch[2]) {
      if (request.method === "GET" || request.method === "HEAD") {
        const valid = Boolean(env.TEXTMAGIC_WEBHOOK_TOKEN)
          && await secureTokenEqual(textMagicMatch[2], env.TEXTMAGIC_WEBHOOK_TOKEN || "");
        if (!valid) return json({ ok: false, error: "unauthorized" }, 401);
        return request.method === "HEAD"
          ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
          : json({ ok: true, provider: "textmagic", event: textMagicMatch[1] });
      }
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
      return handleTextMagicWebhook(request, env, textMagicMatch[1] as "inbound" | "delivery", textMagicMatch[2]);
    }
    if (request.method === "POST" && url.pathname === "/webhooks/textmagic/inbound") return handleTextMagicWebhook(request, env, "inbound");
    if (request.method === "POST" && url.pathname === "/webhooks/textmagic/delivery") return handleTextMagicWebhook(request, env, "delivery");
    if (request.method === "POST" && url.pathname === "/webhooks/bland/post-call") return handleBlandPostCall(request, env);
    if (request.method === "POST" && url.pathname === "/voice/bland/context") return handleBlandContext(request, env);
    if (request.method === "POST" && url.pathname === "/voice/triage-context") return handleVoiceTriageLookup(request, env);
    if (request.method === "POST" && url.pathname === "/voice/check-service-area") return handleVoiceServiceAreaCheck(request, env);
    if (request.method === "POST" && url.pathname === "/admin/bland/sync") {
      if (!authorized(request, env) && !(await blandSyncAuthorized(request, env))) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const limit = Number(url.searchParams.get("limit") || "10");
      const summary = await syncRecentBlandCalls(env, Number.isFinite(limit) ? limit : 10);
      return json({ ok: true, dryRun: env.DRY_RUN === "true", summary }, 202);
    }
    if (request.method === "POST" && url.pathname === "/admin/bland/inbound-sync") {
      if (!authorized(request, env) && !(await blandSyncAuthorized(request, env))) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const summary = await syncBlandInboundNumbers(env);
      return json({ ok: true, dryRun: env.DRY_RUN === "true", summary }, 202);
    }
    if (request.method === "POST" && url.pathname === "/admin/callrail/inventory") {
      if (!authorized(request, env) && !(await blandSyncAuthorized(request, env))) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const summary = await syncCallRailPhoneInventory(env);
      return json({ ok: true, dryRun: env.DRY_RUN === "true", summary }, 202);
    }
    if (request.method === "POST" && url.pathname === "/admin/textmagic/send") {
      if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
      return handleTextMagicSend(request, env);
    }
    if (request.method === "POST" && (url.pathname === "/sync/google-ads" || url.pathname === "/sync/meta-ads")) {
      if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
      return runSync(url.pathname.endsWith("google-ads") ? "google-ads" : "meta-ads", env);
    }
    if (request.method === "POST" && url.pathname === "/sync/drainscapes") {
      if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
      const summary = await runDrainscapesDemandController(env);
      return json({ ok: true, summary }, 202);
    }
    return json({ ok: false, error: "not_found" }, 404);
  },

  async scheduled(_controller: ScheduledController, env: RuntimeEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(Promise.allSettled([
      syncGoogleAds(env),
      syncMetaAds(env),
      runDrainscapesDemandController(env),
    ]).then((results) => {
      const summaries = results.map((result) => result.status === "fulfilled"
        ? { status: "fulfilled", value: result.value }
        : { status: "rejected", reason: result.reason instanceof Error ? result.reason.message : String(result.reason || "unknown") });
      console.log(JSON.stringify({ event: "scheduled_sync_complete", summaries }));
    }));
  },

  async queue(batch: MessageBatch<IntegrationMessage>, env: RuntimeEnv): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (message.body.kind === "provider-event") {
          await ingestProviderEvent(env, message.body);
        } else if (message.body.kind === "meta-lead-notification") {
          const lead = await fetchMetaLead(env, message.body, `meta-queue:${message.id}`);
          await ingestProviderEvent(env, lead);
        } else if (message.body.kind === "daily-metric") {
          throw new Error("legacy_metric_message_rejected_use_supabase_upsert");
        }
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ event: "queue_error", kind: message.body.kind, reason: error instanceof Error ? error.message : "unknown" }));
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<RuntimeEnv, IntegrationMessage>;
