const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES = 24 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;

type RouteStatus = "disabled" | "staging" | "active";

type RouteRow = {
  site_key: string;
  brand_name: string;
  routing_status: RouteStatus;
  active_client_recipient: string | null;
  llg_copy_recipient: string | null;
  sender_address: string | null;
  allowed_origins: string;
  phone_route_id: string | null;
  sms_capability: "disabled" | "approved";
};

export type NormalizedLead = {
  siteKey: string;
  pagePath: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zip: string;
  service: string;
  message: string;
  smsConsent: boolean;
  company: string;
  turnstileToken: string;
  utm: Record<string, string>;
  referrer: string | null;
  landingPage: string;
};

type LeadMessage = Omit<NormalizedLead, "company" | "turnstileToken"> & {
  leadId: string;
  receivedAt: string;
};

type TurnstileResult = {
  success: boolean;
  hostname?: string;
  action?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
};

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(record: Record<string, unknown>, key: string, maximum: number, required = false): string {
  const value = record[key];
  if (value === undefined || value === null) {
    if (required) throw new RequestError(400, "missing_field", `${key} is required.`);
    return "";
  }
  if (typeof value !== "string") throw new RequestError(400, "invalid_field", `${key} must be text.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (required && !normalized) throw new RequestError(400, "missing_field", `${key} is required.`);
  if (normalized.length > maximum) throw new RequestError(400, "field_too_long", `${key} is too long.`);
  return normalized;
}

function optionalUrl(record: Record<string, unknown>, key: string, maximum: number): string | null {
  const value = cleanString(record, key, maximum);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeUtm(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const allowed = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"]);
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!allowed.has(key) || typeof raw !== "string") continue;
    const normalized = raw.replace(/\s+/g, " ").trim().slice(0, 200);
    if (normalized) output[key] = normalized;
  }
  return output;
}

export function normalizeLead(value: unknown): NormalizedLead {
  if (!isRecord(value)) throw new RequestError(400, "invalid_json", "Submit a JSON object.");
  const siteKey = cleanString(value, "siteKey", 80, true).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(siteKey)) throw new RequestError(400, "invalid_site", "The site key is invalid.");
  const pagePath = cleanString(value, "pagePath", 300, true);
  if (!pagePath.startsWith("/") || pagePath.includes("..")) throw new RequestError(400, "invalid_page", "The page path is invalid.");
  const email = cleanString(value, "email", 254, true).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new RequestError(400, "invalid_email", "Enter a valid email address.");
  const phone = cleanString(value, "phone", 40, true);
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 15) throw new RequestError(400, "invalid_phone", "Enter a valid phone number.");
  const zip = cleanString(value, "zip", 10, true);
  if (!ZIP_PATTERN.test(zip)) throw new RequestError(400, "invalid_zip", "Enter a valid ZIP code.");
  const landingPage = cleanString(value, "landingPage", 1200, true);
  try {
    const parsed = new URL(landingPage);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("unsupported protocol");
  } catch {
    throw new RequestError(400, "invalid_landing_page", "The landing page is invalid.");
  }
  return {
    siteKey,
    pagePath,
    firstName: cleanString(value, "firstName", 80, true),
    lastName: cleanString(value, "lastName", 80, true),
    phone,
    email,
    zip,
    service: cleanString(value, "service", 100, true),
    message: cleanString(value, "message", 2400, true),
    smsConsent: value.smsConsent === true,
    company: cleanString(value, "company", 120),
    turnstileToken: cleanString(value, "turnstileToken", 2048, true),
    utm: normalizeUtm(value.utm),
    referrer: optionalUrl(value, "referrer", 1200),
    landingPage,
  };
}

export function parseAllowedOrigins(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function originAllowed(origin: string, allowedOrigins: string): boolean {
  return parseAllowedOrigins(allowedOrigins).includes(origin);
}

function isPreflightOriginAllowed(origin: string): boolean {
  if (origin === "http://localhost:4173" || origin === "http://127.0.0.1:4173") return true;
  return /^https:\/\/clone-rebuild\.[a-z0-9-]+\.pages\.dev$/.test(origin);
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}

function jsonResponse(payload: unknown, status: number, origin: string | null = null): Response {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders(origin) });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new RequestError(413, "body_too_large", "The request is too large.");
  if (!request.body) throw new RequestError(400, "empty_body", "The request body is empty.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel("body too large");
      throw new RequestError(413, "body_too_large", "The request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestError(400, "invalid_json", "Submit valid JSON.");
  }
}

function isTurnstileResult(value: unknown): value is TurnstileResult {
  if (!isRecord(value) || typeof value.success !== "boolean") return false;
  if (value.hostname !== undefined && typeof value.hostname !== "string") return false;
  if (value.action !== undefined && typeof value.action !== "string") return false;
  if (value["error-codes"] !== undefined && (!Array.isArray(value["error-codes"]) || !value["error-codes"].every((item) => typeof item === "string"))) return false;
  return true;
}

export async function validateTurnstile(
  token: string,
  remoteIp: string | null,
  expectedAction: string,
  expectedHostname: string,
  secret: string,
  fetcher: typeof fetch = fetch,
  allowMissingMetadata = false,
): Promise<{ valid: true } | { valid: false; code: string }> {
  const idempotencyKey = crypto.randomUUID();
  let response: Response;
  try {
    response = await fetcher(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: remoteIp ?? undefined, idempotency_key: idempotencyKey }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return { valid: false, code: "turnstile_unavailable" };
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isTurnstileResult(payload)) return { valid: false, code: "turnstile_invalid_response" };
  if (!payload.success) return { valid: false, code: payload["error-codes"]?.includes("timeout-or-duplicate") ? "turnstile_replay" : "turnstile_failed" };
  if (!allowMissingMetadata && payload.action !== expectedAction) return { valid: false, code: "turnstile_action_mismatch" };
  if (!allowMissingMetadata && payload.hostname !== expectedHostname) return { valid: false, code: "turnstile_hostname_mismatch" };
  return { valid: true };
}

function logEvent(event: string, leadId: string, siteKey: string, status: string, attempts?: number): void {
  console.log(JSON.stringify({ event, leadId, siteKey, status, attempts }));
}

function emailEnabled(value: string): boolean {
  return value === "true";
}

async function getRoute(db: D1Database, siteKey: string): Promise<RouteRow | null> {
  return db.prepare(
    "SELECT site_key, brand_name, routing_status, active_client_recipient, llg_copy_recipient, sender_address, allowed_origins, phone_route_id, sms_capability FROM site_routes WHERE site_key = ?",
  ).bind(siteKey).first<RouteRow>();
}

async function writeAudit(db: D1Database, leadId: string, siteKey: string, pagePath: string, status: string, receivedAt: string): Promise<void> {
  await db.prepare(
    "INSERT INTO lead_delivery_audit (lead_id, site_key, page_path, event_status, attempts, received_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
  ).bind(leadId, siteKey, pagePath, status, receivedAt, receivedAt).run();
}

async function updateAudit(db: D1Database, leadId: string, status: string, attempts: number, providerMessageId: string | null, errorCode: string | null): Promise<void> {
  await db.prepare(
    "UPDATE lead_delivery_audit SET event_status = ?, attempts = ?, provider_message_id = ?, error_code = ?, updated_at = ? WHERE lead_id = ?",
  ).bind(status, attempts, providerMessageId, errorCode, new Date().toISOString(), leadId).run();
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function emailBodies(route: RouteRow, lead: LeadMessage): { subject: string; text: string; html: string } {
  const consent = lead.smsConsent ? "Yes (optional checkbox selected)" : "No";
  const attribution = Object.entries(lead.utm).map(([key, value]) => `${key}: ${value}`).join("\n") || "None";
  const lines = [
    `Lead ID: ${lead.leadId}`,
    `Site: ${route.brand_name} (${lead.siteKey})`,
    `Page: ${lead.pagePath}`,
    `Name: ${lead.firstName} ${lead.lastName}`,
    `Phone: ${lead.phone}`,
    `Email: ${lead.email}`,
    `ZIP: ${lead.zip}`,
    `Service: ${lead.service}`,
    `SMS consent: ${consent}`,
    `Message: ${lead.message}`,
    `Landing page: ${lead.landingPage}`,
    `Referrer: ${lead.referrer ?? "None"}`,
    `Attribution:\n${attribution}`,
  ];
  const rows = lines.map((line) => `<p>${htmlEscape(line).replace(/\n/g, "<br>")}</p>`).join("");
  return { subject: `[${route.brand_name}] New ${lead.service} request`, text: lines.join("\n\n"), html: `<h1>New service request</h1>${rows}` };
}

async function handleLead(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const raw = await readBoundedJson(request);
  const lead = normalizeLead(raw);
  const route = await getRoute(env.DB, lead.siteKey);
  if (!route) throw new RequestError(404, "unknown_site", "This site is not configured for intake.");
  if (!origin || !originAllowed(origin, route.allowed_origins)) throw new RequestError(403, "origin_not_allowed", "This origin is not allowed.");
  if (route.routing_status === "disabled") throw new RequestError(503, "routing_disabled", "This site is not accepting requests yet.");
  const leadId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  if (lead.company) {
    await writeAudit(env.DB, leadId, lead.siteKey, lead.pagePath, "honeypot_rejected", receivedAt);
    return jsonResponse({ accepted: true, leadId }, 202, origin);
  }
  const expectedHostname = new URL(origin).hostname;
  const turnstile = await validateTurnstile(
    lead.turnstileToken,
    request.headers.get("CF-Connecting-IP"),
    env.TURNSTILE_EXPECTED_ACTION,
    expectedHostname,
    env.TURNSTILE_SECRET_KEY,
    fetch,
    env.MODE === "staging",
  );
  if (!turnstile.valid) throw new RequestError(400, turnstile.code, "Verification failed. Refresh the form and try again.");
  await writeAudit(env.DB, leadId, lead.siteKey, lead.pagePath, "received", receivedAt);
  const message: LeadMessage = {
    leadId,
    receivedAt,
    siteKey: lead.siteKey,
    pagePath: lead.pagePath,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email,
    zip: lead.zip,
    service: lead.service,
    message: lead.message,
    smsConsent: lead.smsConsent,
    utm: lead.utm,
    referrer: lead.referrer,
    landingPage: lead.landingPage,
  };
  try {
    await env.LEAD_QUEUE.send(message, { contentType: "json" });
  } catch {
    await updateAudit(env.DB, leadId, "queue_failed", 0, null, "queue_unavailable");
    throw new RequestError(503, "queue_unavailable", "The request could not be queued. Please try again.");
  }
  await updateAudit(env.DB, leadId, "queued", 0, null, null);
  logEvent("lead_received", leadId, lead.siteKey, "queued");
  return jsonResponse({ accepted: true, leadId }, 202, origin);
}

async function handleQueueMessage(message: Message<LeadMessage>, env: Env): Promise<void> {
  const lead = message.body;
  const route = await getRoute(env.DB, lead.siteKey);
  if (!route) {
    await updateAudit(env.DB, lead.leadId, "routing_missing", message.attempts, null, "route_missing");
    message.ack();
    return;
  }
  if (route.routing_status === "staging") {
    await updateAudit(env.DB, lead.leadId, "staging_accepted", message.attempts, null, null);
    logEvent("lead_delivery", lead.leadId, lead.siteKey, "staging_accepted", message.attempts);
    message.ack();
    return;
  }
  const clientRecipient = route.active_client_recipient;
  const llgRecipient = route.llg_copy_recipient;
  const sender = route.sender_address || env.DEFAULT_SENDER;
  if (route.routing_status !== "active" || !emailEnabled(env.EMAIL_ENABLED) || !clientRecipient || !llgRecipient || !sender || !env.EMAIL) {
    await updateAudit(env.DB, lead.leadId, "delivery_blocked", message.attempts, null, "route_incomplete");
    message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
    return;
  }
  const recipients = [...new Set([clientRecipient, llgRecipient])];
  if (!recipients.every((recipient) => EMAIL_PATTERN.test(recipient)) || !EMAIL_PATTERN.test(sender)) {
    await updateAudit(env.DB, lead.leadId, "delivery_blocked", message.attempts, null, "invalid_route_email");
    message.retry({ delaySeconds: 900 });
    return;
  }
  const bodies = emailBodies(route, lead);
  try {
    const result = await env.EMAIL.send({
      to: recipients,
      from: { email: sender, name: route.brand_name },
      replyTo: lead.email,
      subject: bodies.subject,
      text: bodies.text,
      html: bodies.html,
    });
    await updateAudit(env.DB, lead.leadId, "delivered", message.attempts, result.messageId, null);
    logEvent("lead_delivery", lead.leadId, lead.siteKey, "delivered", message.attempts);
    message.ack();
  } catch {
    await updateAudit(env.DB, lead.leadId, "delivery_retry", message.attempts, null, "email_send_failed");
    logEvent("lead_delivery", lead.leadId, lead.siteKey, "delivery_retry", message.attempts);
    message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      return origin && isPreflightOriginAllowed(origin)
        ? new Response(null, { status: 204, headers: corsHeaders(origin) })
        : jsonResponse({ error: "origin_not_allowed" }, 403);
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ status: "ok", mode: env.MODE, emailEnabled: emailEnabled(env.EMAIL_ENABLED) }, 200);
    }
    if (request.method !== "POST" || url.pathname !== "/v1/leads") return jsonResponse({ error: "not_found" }, 404, origin);
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return jsonResponse({ error: "unsupported_media_type", message: "Use application/json." }, 415, origin);
    try {
      return await handleLead(request, env);
    } catch (error) {
      if (error instanceof RequestError) return jsonResponse({ error: error.code, message: error.message }, error.status, origin);
      console.error(JSON.stringify({ event: "lead_request_error", path: url.pathname, errorCode: "internal_error" }));
      return jsonResponse({ error: "internal_error", message: "The request could not be processed." }, 500, origin);
    }
  },
  async queue(batch: MessageBatch<LeadMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await handleQueueMessage(message, env);
    }
  },
} satisfies ExportedHandler<Env, LeadMessage>;
