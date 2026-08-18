import type { CanonicalProviderEvent, RuntimeEnv } from "./types";
import { paidEvidence } from "./canonical";
import factorySiteConfig from "../config/factory-sites.json";

interface WebsiteSite {
  propertyKey: string;
  domain: string;
  pagesProject: string;
  reviewHosts: string[];
  turnstileGroup: string | null;
}

const SITE_ROWS = [
  ["austin-drain-guys", "austindrainguys.com", "austin-drain-guys"],
  ["baltimore-french-drain", "baltimorefrenchdrain.com", "baltimore-french-drain"],
  ["charlotte-crawl-space", "charlottecrawlspace.com", "charlotte-crawl-space"],
  ["charlotte-precision-walls", "charlotteprecisionwalls.com", "charlotte-precision-walls"],
  ["chicago-drainage-guys", "chicagodrainageguys.com", "chicago-drainage-guys"],
  ["cincinnati-precision-walls", "cincinnatiprecisionwalls.com", "cincinnati-precision-walls"],
  ["connecticut-drain-pros", "connecticutdrainpros.com", "connecticut-drain-pros"],
  ["crawlspace-cary-nc", "crawlspacecarync.com", "crawlspace-cary-nc"],
  ["crawlspace-durham", "crawlspacedurham.com", "crawlspace-durham"],
  ["crawlspace-greensboro", "crawlspacegreensboro.com", "crawlspace-greensboro"],
  ["crawlspace-raleigh", "crawlspaceraleigh.com", "crawlspace-raleigh"],
  ["crawlspace-wilmington", "crawlspacewilmington.com", "crawlspace-wilmington"],
  ["dallas-drain-guys", "dallasdrainguys.com", "dallas-drain-guys"],
  ["greensboro-drain-guys", "greensborodrainguys.com", "greensboro-drain-guys"],
  ["jackson-french-drain", "jacksonfrenchdrain.com", "jackson-french-drain"],
  ["little-rock-french-drain", "littlerockfrenchdrain.com", "little-rock-french-drain"],
  ["little-rock-precision-walls", "littlerockprecisionwalls.com", "little-rock-precision-walls"],
  ["louisville-precision-walls", "louisvilleprecisionwalls.com", "louisville-precision-walls"],
  ["morgantown-fence-pros", "morgantownfencepros.com", "morgantown-fence-pros"],
  ["naples-pool-pros", "naplespoolpros.com", "naples-pool-pros"],
  ["nashville-crawlspace", "nashville-crawlspace.com", "nashville-crawlspace"],
  ["nashville-backyards", "nashvillebackyards.com", "nashville-backyards"],
  ["new-orleans-french-drain", "neworleansfrenchdrain.com", "new-orleans-french-drain"],
  ["pgh-painting-pros", "pghpaintingpros.com", "pgh-painting-pros"],
  ["pgh-pool-service", "pghpoolservice.com", "pgh-pool-service"],
  ["pittsburgh-french-drain", "pghfrenchdrains.com", "pittsburgh-french-drain-site"],
  ["salt-lake-city-precision-walls", "saltlakecityprecisionwalls.com", "salt-lake-city-precision-walls"],
  ["tulsa-drain-pros", "tulsadrainpros.com", "tulsa-drain-pros"],
  ["ws-crawl-space", "wscrawlspace.com", "ws-crawl-space"],
] as const;

const turnstileGroupByDomain = new Map(
  factorySiteConfig.sites.map((site) => [site.domain, site.turnstileGroup] as const),
);

const legacySites = SITE_ROWS.map(([siteKey, domain, pagesProject]) => [siteKey, {
    propertyKey: `domain:${domain}`,
    domain,
    pagesProject,
    reviewHosts: [
      `${pagesProject}.pages.dev`,
      `clone-rebuild.${pagesProject}.pages.dev`,
    ],
    turnstileGroup: turnstileGroupByDomain.get(domain) || null,
  }] as const);

const factorySites = factorySiteConfig.sites.map((site) => [site.siteKey, {
  propertyKey: site.propertyKey,
  domain: site.domain,
  pagesProject: site.workerName,
  reviewHosts: site.reviewHosts,
  turnstileGroup: site.turnstileGroup,
}] as const);

export const WEBSITE_SITES: Record<string, WebsiteSite> = Object.fromEntries([
  ...legacySites,
  ...factorySites,
]);

export const FACTORY_WEBSITE_SITE_COUNT = factorySiteConfig.sites.length;

function text(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizedPhone(value: unknown): string {
  const raw = text(value, 40);
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error("invalid_phone");
}

function safeRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => /^[a-z0-9_]{1,40}$/i.test(key) && typeof item === "string")
      .map(([key, item]) => [key, text(item, 500)])
      .filter(([, item]) => item),
  );
}

export function websiteCorsOrigin(request: Request, siteKey = ""): string | null {
  const origin = request.headers.get("origin") || "";
  if (!origin) return null;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null;
  if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && siteKey) return origin;
  if (!siteKey) {
    const hostname = parsed.hostname.toLowerCase();
    return Object.values(WEBSITE_SITES).some((item) => new Set([
      item.domain,
      `www.${item.domain}`,
      ...item.reviewHosts,
    ]).has(hostname)) ? origin : null;
  }
  const site = WEBSITE_SITES[siteKey];
  if (!site) return null;
  const allowed = new Set([
    site.domain,
    `www.${site.domain}`,
    ...site.reviewHosts,
  ]);
  return allowed.has(parsed.hostname.toLowerCase()) ? origin : null;
}

export function isProductionWebsiteOrigin(origin: string, siteKey: string): boolean {
  const site = WEBSITE_SITES[siteKey];
  if (!site) return false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === site.domain || hostname === `www.${site.domain}`;
  } catch {
    return false;
  }
}

export function websiteTurnstileSecret(env: RuntimeEnv, siteKey: string, origin: string): string {
  if (!isProductionWebsiteOrigin(origin, siteKey)) return env.TURNSTILE_SECRET_KEY || "";
  const group = WEBSITE_SITES[siteKey]?.turnstileGroup;
  if (group === "production-a") return env.TURNSTILE_SECRET_KEY_A || "";
  if (group === "production-b") return env.TURNSTILE_SECRET_KEY_B || "";
  return "";
}

export function canonicalWebsiteLead(
  payload: Record<string, unknown>,
  requestId: string,
  receivedAt: string,
  testMode: boolean,
): CanonicalProviderEvent {
  const siteKey = text(payload.siteKey, 100).toLowerCase();
  const site = WEBSITE_SITES[siteKey];
  if (!site) throw new Error("unknown_site");
  const submissionId = text(payload.submissionId, 100) || crypto.randomUUID();
  const firstName = text(payload.firstName, 100);
  const lastName = text(payload.lastName, 100);
  const email = text(payload.email, 320).toLowerCase();
  const zip = text(payload.zip, 10);
  const address = text(payload.address, 500);
  const service = text(payload.service, 160);
  const message = text(payload.message, 5000);
  if (!firstName || !lastName || !email || (!zip && !address) || !service || !message) throw new Error("missing_required_fields");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid_email");
  if (zip && !/^\d{5}(?:-\d{4})?$/.test(zip)) throw new Error("invalid_zip");
  const phone = normalizedPhone(payload.phone);
  const firstTouch = safeRecord(payload.firstTouch);
  const lastTouch = safeRecord(payload.lastTouch);
  const attribution = Object.keys(lastTouch).length ? lastTouch : safeRecord(payload.utm);
  const acquisition = paidEvidence(attribution);
  const pagePath = text(payload.pagePath, 500) || "/";
  const landingPage = text(payload.landingPage, 2000);
  const referrer = text(payload.referrer, 2000);
  return {
    kind: "provider-event",
    provider: "website",
    provider_event_id: submissionId,
    event_type: "form_submission",
    idempotency_key: `website:${siteKey}:${submissionId}`,
    property_key: site.propertyKey,
    mapping_keys: [],
    acquisition_source: acquisition.source,
    acquisition_confidence: acquisition.confidence,
    conversion_channel: "website_form",
    occurred_at: receivedAt,
    test_mode: testMode,
    contact: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`, phone, normalized_phone: phone, email, normalized_email: email, address_line_1: address, postal_code: zip },
    consent: { granted: true, sms_granted: payload.smsConsent === true, source: "website_form", text: text(payload.consentText, 2000) || "Contact requested through the website service form." },
    service: { requested: service, slug: service },
    qualification: { postal_code: zip, address_line_1: address, first_touch: firstTouch },
    attribution: { ...attribution, page_path: pagePath, landing_page_url: landingPage, referrer_url: referrer },
    correlation_ids: { submission_id: submissionId, site_key: siteKey },
    summary: `${service} request from ${firstName} ${lastName}`,
    message,
    raw_payload: { ...payload, firstTouch, lastTouch: attribution, phone, email, siteKey, submissionId },
    request_id: requestId,
  };
}

export function canonicalWebsiteTextStart(
  payload: Record<string, unknown>,
  requestId: string,
  receivedAt: string,
  testMode: boolean,
): CanonicalProviderEvent {
  const siteKey = text(payload.siteKey, 100).toLowerCase();
  const site = WEBSITE_SITES[siteKey];
  if (!site) throw new Error("unknown_site");
  const submissionId = text(payload.submissionId, 100) || crypto.randomUUID();
  const fullName = text(payload.fullName, 200).replace(/\s+/g, " ");
  const service = text(payload.service, 160);
  const message = text(payload.message, 5000);
  const postalCode = text(payload.zip, 10);
  const consentText = text(payload.consentText, 1000);
  const consentVersion = text(payload.consentVersion, 60) || "website-text-widget-v1";
  if (!fullName || !service || !message) throw new Error("missing_required_fields");
  if (payload.smsConsent !== true || !consentText) throw new Error("sms_consent_required");
  if (postalCode && !/^\d{5}(?:-\d{4})?$/.test(postalCode)) throw new Error("invalid_zip");
  const phone = normalizedPhone(payload.phone);
  const nameParts = fullName.split(" ");
  const firstName = nameParts.shift() || fullName;
  const lastName = nameParts.join(" ");
  const firstTouch = safeRecord(payload.firstTouch);
  const lastTouch = safeRecord(payload.lastTouch);
  const attribution = Object.keys(lastTouch).length ? lastTouch : safeRecord(payload.utm);
  const acquisition = paidEvidence(attribution);
  const pagePath = text(payload.pagePath, 500) || "/";
  const landingPage = text(payload.landingPage, 2000);
  const referrer = text(payload.referrer, 2000);
  return {
    kind: "provider-event",
    provider: "website",
    provider_event_id: submissionId,
    event_type: "website_text_start",
    idempotency_key: `website-text:${siteKey}:${submissionId}`,
    property_key: site.propertyKey,
    mapping_keys: [],
    acquisition_source: acquisition.source,
    acquisition_confidence: acquisition.confidence,
    conversion_channel: "sms",
    occurred_at: receivedAt,
    test_mode: testMode,
    contact: { first_name: firstName, last_name: lastName, full_name: fullName, phone, normalized_phone: phone, postal_code: postalCode },
    consent: {
      granted: true,
      sms_granted: true,
      source: "website_text_widget",
      text: consentText,
      version: consentVersion,
      captured_at: receivedAt,
    },
    service: { requested: service, slug: service },
    qualification: { postal_code: postalCode, initial_project_details: message, first_touch: firstTouch },
    attribution: { ...attribution, page_path: pagePath, landing_page_url: landingPage, referrer_url: referrer },
    correlation_ids: { submission_id: submissionId, site_key: siteKey },
    summary: `${service} text request from ${fullName}`,
    message,
    raw_payload: { ...payload, firstTouch, lastTouch: attribution, phone, siteKey, submissionId },
    request_id: requestId,
  };
}

export async function verifyWebsiteTurnstile(
  env: RuntimeEnv,
  token: string,
  remoteIp: string | null,
  siteKey = "",
  origin = "",
): Promise<boolean> {
  const secret = websiteTurnstileSecret(env, siteKey, origin);
  if (!secret || !token) return false;
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const result = await response.json() as Record<string, unknown>;
  if (result.success !== true) return false;
  const expectedAction = env.TURNSTILE_EXPECTED_ACTION || "lead_submit";
  return typeof result.action !== "string" || !result.action || result.action === expectedAction;
}
