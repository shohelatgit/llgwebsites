import { CONTACT_CONSENT_TEXT, CONTACT_CONSENT_VERSION, VERTICAL_FORM_SPECS } from "./fillout-schema";
import { normalizePhone } from "./normalize";
import type { CanonicalFilloutSubmission, FilloutQuestion, FilloutUrlParameter } from "./types";

type JsonObject = Record<string, unknown>;

const MAX_TEXT_LENGTH = 4_000;

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "campaign_id",
  "campaign_name",
  "ad_group_id",
  "ad_group_name",
  "ad_id",
  "ad_name",
  "keyword",
  "match_type",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "rdt_cid",
  "ttclid",
  "li_fat_id",
  "landing_page_url",
  "referrer_url",
  "visitor_id",
  "session_id",
  "clarity_session_id",
] as const;

const QUALIFICATION_KEY_BY_PROMPT = new Map(
  [
    ...VERTICAL_FORM_SPECS.flatMap((spec) => spec.questions.map((question) => [normalizedKey(question.prompt), question.key] as const)),
    [normalizedKey("Do you own the property?"), "property_ownership"],
    [normalizedKey("When would you like the work completed?"), "project_timeline"],
    [normalizedKey("What is your estimated budget?"), "budget_range"],
  ],
);

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().slice(0, maxLength);
  }
  if (Array.isArray(value)) return value.map((item) => boundedText(item, 500)).filter(Boolean).join(", ").slice(0, maxLength);
  if (isObject(value)) {
    const preferred = ["value", "label", "text", "name", "fullName"];
    for (const key of preferred) {
      const candidate = boundedText(value[key], maxLength);
      if (candidate) return candidate;
    }
  }
  return "";
}

function normalizedKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function questionList(value: unknown): FilloutQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): FilloutQuestion[] => {
    if (!isObject(item)) return [];
    const name = boundedText(item.name, 200);
    if (!name) return [];
    return [{
      id: boundedText(item.id, 200) || undefined,
      name,
      type: boundedText(item.type, 100) || undefined,
      value: item.value,
    }];
  });
}

function parameterList(value: unknown): FilloutUrlParameter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): FilloutUrlParameter[] => {
    if (!isObject(item)) return [];
    const name = normalizedKey(boundedText(item.name, 100));
    if (!name) return [];
    return [{
      id: boundedText(item.id, 200) || undefined,
      name,
      value: boundedText(item.value, 2_000),
    }];
  });
}

function findQuestion(questions: FilloutQuestion[], aliases: readonly string[]): unknown {
  const wanted = new Set(aliases.map(normalizedKey));
  return questions.find((question) => wanted.has(normalizedKey(question.name)))?.value;
}

function findParameter(parameters: FilloutUrlParameter[], name: string): string {
  return parameters.find((parameter) => parameter.name === normalizedKey(name))?.value ?? "";
}

function addressParts(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const source = value;
  return {
    addressLine1: boundedText(source.addressLine1 ?? source.address ?? source.line1, 500),
    addressLine2: boundedText(source.addressLine2 ?? source.line2, 500),
    city: boundedText(source.city, 200),
    stateRegion: boundedText(source.state ?? source.stateRegion ?? source.region, 100),
    postalCode: boundedText(source.zipCode ?? source.postalCode ?? source.zip, 30),
  };
}

function nameParts(value: unknown): { fullName: string; firstName: string; lastName: string } {
  if (isObject(value)) {
    const firstName = boundedText(value.firstName ?? value.first, 150);
    const lastName = boundedText(value.lastName ?? value.last, 150);
    const fullName = boundedText(value.fullName ?? value.name, 300) || `${firstName} ${lastName}`.trim();
    return { fullName, firstName, lastName };
  }
  const fullName = boundedText(value, 300);
  const parts = fullName.split(/\s+/).filter(Boolean);
  return { fullName, firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function consentGranted(value: unknown): boolean {
  if (value === true) return true;
  if (Array.isArray(value)) return value.some(consentGranted);
  const normalized = boundedText(value, 500).toLowerCase();
  return ["true", "yes", "i agree", "agree", "accepted", "checked"].some((token) => normalized === token || normalized.includes(token));
}

function sourceCategory(attribution: Record<string, string>): string {
  const medium = attribution.utm_medium?.toLowerCase() ?? "";
  if (attribution.gclid || attribution.gbraid || attribution.wbraid || attribution.fbclid || attribution.msclkid) return "paid";
  if (["cpc", "ppc", "paid", "paid_social", "display"].some((value) => medium.includes(value))) return "paid";
  if (medium.includes("organic")) return "organic";
  if (attribution.referrer_url) return "referral";
  return "direct";
}

export function parseFilloutSubmission(payload: unknown, receivedAt: string): CanonicalFilloutSubmission {
  if (!isObject(payload)) throw new Error("invalid_fillout_payload");
  const source = isObject(payload.submission) ? payload.submission : payload;
  const submissionId = boundedText(source.submissionId ?? source.submission_id, 200);
  if (!submissionId) throw new Error("missing_submission_id");

  const questions = questionList(source.questions);
  const urlParameters = parameterList(source.urlParameters ?? source.url_parameters);
  const propertyKey = findParameter(urlParameters, "site_key");
  if (!propertyKey) throw new Error("missing_site_key");

  const name = nameParts(findQuestion(questions, ["name", "full name", "your name"]));
  const phone = normalizePhone(findQuestion(questions, ["phone", "phone number", "mobile phone", "mobile"]));
  const email = boundedText(findQuestion(questions, ["email", "email address"]), 320).toLowerCase();
  if (!name.fullName || !phone || !email) throw new Error("missing_required_contact_fields");

  const addressValue = findQuestion(questions, ["address", "service address", "property address"]);
  const structuredAddress = addressParts(addressValue);
  const addressLine1 = structuredAddress.addressLine1
    || boundedText(findQuestion(questions, ["street address", "address line 1"]), 500);
  const addressLine2 = structuredAddress.addressLine2
    || boundedText(findQuestion(questions, ["address line 2", "unit", "suite"]), 500);
  const city = structuredAddress.city || boundedText(findQuestion(questions, ["city"]), 200);
  const stateRegion = structuredAddress.stateRegion || boundedText(findQuestion(questions, ["state", "state region"]), 100);
  const postalCode = structuredAddress.postalCode || boundedText(findQuestion(questions, ["zip code", "postal code", "zip"]), 30);

  const consentValue = findQuestion(questions, ["contact consent", "consent to contact", "permission to contact"]);
  const granted = consentGranted(consentValue);
  if (!granted) throw new Error("contact_consent_required");

  const attribution: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) attribution[key] = findParameter(urlParameters, key);
  attribution.source_category = sourceCategory(attribution);

  const commonQuestionKeys = new Set([
    "name", "full_name", "your_name", "phone", "phone_number", "mobile_phone", "mobile",
    "email", "email_address", "address", "service_address", "property_address", "street_address",
    "address_line_1", "address_line_2", "unit", "suite", "city", "state", "state_region",
    "zip_code", "postal_code", "zip", "message", "project_details", "additional_details",
    "contact_consent", "consent_to_contact", "permission_to_contact",
  ]);
  const answers: Record<string, unknown> = {};
  for (const question of questions) {
    const normalizedQuestionName = normalizedKey(question.name);
    if (!normalizedQuestionName || commonQuestionKeys.has(normalizedQuestionName)) continue;
    const answerKey = QUALIFICATION_KEY_BY_PROMPT.get(normalizedQuestionName) ?? normalizedQuestionName;
    answers[answerKey] = question.value;
  }

  const submissionTime = boundedText(source.submissionTime ?? source.submission_time, 100);
  return {
    submissionId,
    submissionTime: Number.isFinite(Date.parse(submissionTime)) ? new Date(submissionTime).toISOString() : receivedAt,
    propertyKey,
    ...name,
    phone,
    email,
    addressLine1,
    addressLine2,
    city,
    stateRegion,
    postalCode,
    message: boundedText(findQuestion(questions, ["message", "project details", "additional details"]), MAX_TEXT_LENGTH),
    consentGranted: granted,
    consentText: CONTACT_CONSENT_TEXT,
    consentVersion: CONTACT_CONSENT_VERSION,
    attribution,
    answers,
    questions,
    urlParameters,
  };
}
