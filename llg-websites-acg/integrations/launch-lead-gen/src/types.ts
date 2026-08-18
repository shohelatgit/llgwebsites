export type AirtableFieldValue = string | number | boolean | string[];
export type LeadFields = Record<string, AirtableFieldValue>;

export interface LeadMessage {
  kind: "lead";
  source: "CallRail" | "Meta Ads";
  sourceKey: string;
  externalId: string;
  routingKeys: string[];
  fields: LeadFields;
}

export interface ProviderMappingKey {
  platform: string;
  external_type: string;
  external_id: string;
}

export interface CanonicalProviderEvent {
  kind: "provider-event";
  provider: "callrail" | "fillout" | "website" | "meta_lead_ads" | "google_lead_form";
  provider_event_id: string;
  event_type: string;
  idempotency_key: string;
  property_key?: string;
  mapping_keys: ProviderMappingKey[];
  acquisition_source: string;
  acquisition_confidence: "confirmed" | "explicit" | "inferred" | "ambiguous" | "unverified" | "unknown";
  conversion_channel: "website_form" | "phone_call" | "sms";
  occurred_at: string;
  test_mode: boolean;
  contact: Record<string, unknown>;
  consent: Record<string, unknown>;
  service: Record<string, unknown>;
  qualification: Record<string, unknown>;
  attribution: Record<string, unknown>;
  correlation_ids: Record<string, unknown>;
  summary?: string;
  message?: string;
  raw_payload: Record<string, unknown>;
  request_id: string;
}

export interface FilloutQuestion {
  id?: string;
  name: string;
  type?: string;
  value: unknown;
}

export interface FilloutUrlParameter {
  id?: string;
  name: string;
  value: string;
}

export interface CanonicalFilloutSubmission {
  submissionId: string;
  submissionTime: string;
  propertyKey: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  message: string;
  consentGranted: boolean;
  consentText: string;
  consentVersion: string;
  attribution: Record<string, string>;
  answers: Record<string, unknown>;
  questions: FilloutQuestion[];
  urlParameters: FilloutUrlParameter[];
}

export interface FilloutIngestResult {
  accepted: boolean;
  duplicate: boolean;
  leadId: number;
  leadPublicId: string;
  propertyId: number;
  serviceId: number;
  testMode: boolean;
}

export interface BlandCallIngestResult {
  accepted: boolean;
  voiceCallId: number;
  externalCallId: string;
  propertyId: number | null;
  leadId: number | null;
  mappingStatus: "matched" | "unmatched" | "ambiguous";
  testMode: boolean;
}

export interface BlandSyncSummary {
  discovered: number;
  processed: number;
  matched: number;
  unmatched: number;
  failed: number;
}

export interface BlandInboundSyncSummary {
  discovered: number;
  matched: number;
  configured: number;
  unmatched: number;
  failed: number;
}

export interface CallRailInventorySummary {
  accounts: number;
  trackersDiscovered: number;
  trackersUpserted: number;
  numbersSeen: number;
  numbersMatched: number;
  numbersUnmatched: number;
  numberConflicts: number;
  companyInferredNumbers: number;
}

export interface MetaLeadNotification {
  kind: "meta-lead-notification";
  source: "Meta Ads";
  sourceKey: string;
  externalId: string;
  pageId: string;
  formId?: string;
  adId?: string;
  adGroupId?: string;
  createdTime?: number;
}

export interface DailyMetricMessage {
  kind: "daily-metric";
  source: "Google Ads" | "Meta Ads";
  sourceKey: string;
  metric?: Record<string, unknown>;
  fields: Record<string, string | number>;
}

export interface PilotLeadMessage {
  kind: "pilot-lead";
  idempotencyKey: string;
  leadPublicId: string;
  propertyKey: string;
  formId: string;
  submissionId: string;
  submittedAt: string;
  testMode: boolean;
  contact: {
    fullName: string;
    phone: string;
    email: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateRegion: string;
    postalCode: string;
  };
  message: string;
  answers: Record<string, unknown>;
  attribution: Record<string, string>;
}

export interface PilotSiteConfig {
  property_key: string;
  domain: string;
  display_name: string;
  primary_phone: string;
  sms_phone: string;
  sms_enabled: boolean;
  city: string;
  state_region: string;
  timezone: string;
  consent_disclosure: string;
  test_mode: boolean;
  form: {
    provider: "fillout";
    form_id: string;
    template_key: string;
    status: "testing" | "active";
  };
  services: Array<{
    slug: string;
    name: string;
  }>;
}

export interface SmsQualificationReply {
  shouldSend: boolean;
  reason?: string;
  sessionId: number | null;
  propertyId: number | null;
  leadId: number | null;
  toPhone: string;
  fromPhone: string;
  message: string;
  status: string;
  step: number;
}

export type IntegrationMessage =
  | CanonicalProviderEvent
  | MetaLeadNotification
  | DailyMetricMessage;

export interface SyncSummary {
  source: "Google Ads" | "Meta Ads";
  accounts: number;
  recordsQueued: number;
  skipped: boolean;
  reason?: string;
}

export interface SecretBindings {
  /** Legacy only. No production code path writes to Airtable. */
  AIRTABLE_ACCESS_TOKEN: string;
  AIRTABLE_BASE_ID: string;
  AIRTABLE_LEADS_TABLE_ID: string;
  AIRTABLE_METRICS_TABLE: string;
  AIRTABLE_MAPPINGS_TABLE: string;
  AIRTABLE_ROUTING_RULES_TABLE_ID: string;
  AIRTABLE_LEAD_DELIVERIES_TABLE_ID: string;
  AIRTABLE_CLIENT_COMMUNICATIONS_TABLE_ID: string;
  CALLRAIL_SIGNING_KEY: string;
  CALLRAIL_SIGNING_KEYS?: string;
  CALLRAIL_API_KEY?: string;
  META_APP_SECRET: string;
  META_VERIFY_TOKEN: string;
  META_PAGE_ACCESS_TOKEN: string;
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  GOOGLE_ADS_CLIENT_ID: string;
  GOOGLE_ADS_CLIENT_SECRET: string;
  GOOGLE_ADS_REFRESH_TOKEN: string;
  DRAINSCAPES_MUTATIONS_ENABLED?: string;
  DRAINSCAPES_REPORT_WEBHOOK_URL?: string;
  DRAINSCAPES_REPORT_WEBHOOK_TOKEN?: string;
  DRAINSCAPES_REPORT_CHANNEL?: "dashboard" | "webhook";
  ADMIN_SYNC_TOKEN: string;
  FILLOUT_WEBHOOK_TOKEN: string;
  SUPABASE_INGEST_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SECRET_KEY_A?: string;
  TURNSTILE_SECRET_KEY_B?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
  BLAND_API_KEY: string;
  BLAND_WEBHOOK_TOKEN: string;
  BLAND_INGEST_TOKEN: string;
  BLAND_SYNC_TOKEN: string;
  BLAND_WEBHOOK_SIGNING_SECRET?: string;
  ZAPIER_CATCH_HOOK_URL?: string;
  ZAPIER_DELIVERY_TOKEN?: string;
  TEXTMAGIC_WEBHOOK_TOKEN?: string;
  TEXTMAGIC_USERNAME?: string;
  TEXTMAGIC_API_KEY?: string;
  TEXTMAGIC_DEFAULT_FROM?: string;
  TEXTMAGIC_DELIVERY_ENABLED?: string;
  DELIVERY_ENABLED?: string;
  WEBSITE_PRODUCTION_ORIGINS_ENABLED?: string;
  PILOT_SITE_KEYS: string;
}

export type RuntimeEnv = Env & SecretBindings;
