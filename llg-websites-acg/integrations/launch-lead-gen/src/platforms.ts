import { canonicalMetaLeadEvent } from "./canonical";
import { metaFieldMap } from "./normalize";
import { recordIntegrationSyncRun, upsertPortfolioAdMetric } from "./supabase";
import type { CanonicalProviderEvent, MetaLeadNotification, RuntimeEnv, SyncSummary } from "./types";

type JsonObject = Record<string, unknown>;

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.replace(/\D/g, "")).filter(Boolean);
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function metricDatesUtc(now = new Date()): { today: string; previous: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const previous = new Date(today.getTime() - 86_400_000);
  return { today: today.toISOString().slice(0, 10), previous: previous.toISOString().slice(0, 10) };
}

export async function googleAccessToken(env: RuntimeEnv): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json<{ access_token?: string; error?: string }>();
  if (!response.ok || !payload.access_token) throw new Error(`google_oauth:${payload.error ?? response.status}`);
  return payload.access_token;
}

function googleAdsHeaders(env: RuntimeEnv, accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "content-type": "application/json",
  };
  const loginCustomerId = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, "");
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  return headers;
}

async function googleAdsMutate(
  env: RuntimeEnv,
  accessToken: string,
  customerId: string,
  resource: "campaigns" | "campaignBudgets",
  body: JsonObject,
): Promise<JsonObject> {
  const response = await fetch(`https://googleads.googleapis.com/${env.GOOGLE_ADS_API_VERSION}/customers/${customerId}/${resource}:mutate`, {
    method: "POST",
    headers: googleAdsHeaders(env, accessToken),
    body: JSON.stringify(body),
  });
  const payload = await response.json<JsonObject>();
  if (!response.ok) {
    const detail = JSON.stringify(payload).replace(/\s+/g, " ").slice(0, 500);
    throw new Error(`google_ads_${resource}_${response.status}:${detail}`);
  }
  return payload;
}

export async function applyGoogleMarketControl(
  env: RuntimeEnv,
  input: {
    customerId: string;
    campaignId: string;
    budgetResourceName: string;
    fulfillmentEnabled: boolean;
    dailyBudget: number;
  },
  accessToken?: string,
): Promise<void> {
  const token = accessToken || await googleAccessToken(env);
  const customerId = input.customerId.replace(/\D/g, "");
  const campaignResourceName = `customers/${customerId}/campaigns/${input.campaignId.replace(/\D/g, "")}`;
  if (!input.fulfillmentEnabled) {
    await googleAdsMutate(env, token, customerId, "campaigns", {
      operations: [{ update: { resourceName: campaignResourceName, status: "PAUSED" }, updateMask: "status" }],
    });
    return;
  }
  await googleAdsMutate(env, token, customerId, "campaignBudgets", {
    operations: [{
      update: { resourceName: input.budgetResourceName, amountMicros: String(Math.round(input.dailyBudget * 1_000_000)) },
      updateMask: "amount_micros",
    }],
  });
  await googleAdsMutate(env, token, customerId, "campaigns", {
    operations: [{ update: { resourceName: campaignResourceName, status: "ENABLED" }, updateMask: "status" }],
  });
}

export async function syncGoogleAds(env: RuntimeEnv): Promise<SyncSummary> {
  const customerIds = splitCsv(env.GOOGLE_ADS_CUSTOMER_IDS);
  if (!customerIds.length) {
    await recordIntegrationSyncRun(env, { provider: "google_ads", sync_kind: "metrics", status: "failed", finished_at: new Date().toISOString(), failure_details: [{ reason: "no_customer_ids" }] });
    return { source: "Google Ads", accounts: 0, recordsQueued: 0, skipped: true, reason: "no_customer_ids" };
  }
  const required = [env.GOOGLE_ADS_CLIENT_ID, env.GOOGLE_ADS_CLIENT_SECRET, env.GOOGLE_ADS_REFRESH_TOKEN, env.GOOGLE_ADS_DEVELOPER_TOKEN];
  if (required.some((value) => !value)) {
    await recordIntegrationSyncRun(env, { provider: "google_ads", sync_kind: "metrics", status: "failed", finished_at: new Date().toISOString(), failure_details: [{ reason: "missing_credentials" }] });
    return { source: "Google Ads", accounts: customerIds.length, recordsQueued: 0, skipped: true, reason: "missing_credentials" };
  }

  const dates = metricDatesUtc();
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await recordIntegrationSyncRun(env, { id: runId, provider: "google_ads", sync_kind: "metrics", status: "running", started_at: startedAt });
  let recordsQueued = 0;
  let inserted = 0;
  let updated = 0;
  let unmapped = 0;
  try {
  const accessToken = await googleAccessToken(env);
  for (const customerId of customerIds) {
    const query = `SELECT campaign.id, campaign.name, campaign.status, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${dates.previous}' AND '${dates.today}' AND campaign.status != 'REMOVED'`;
    const headers = googleAdsHeaders(env, accessToken);
    const response = await fetch(`https://googleads.googleapis.com/${env.GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    const payload = await response.json<unknown>();
    if (!response.ok) throw new Error(`google_ads_${response.status}`);
    const chunks = Array.isArray(payload) ? payload : [];
    for (const chunk of chunks) {
      const rows = Array.isArray(asObject(chunk).results) ? (asObject(chunk).results as unknown[]) : [];
      for (const rowValue of rows) {
        const row = asObject(rowValue);
        const campaign = asObject(row.campaign);
        const segments = asObject(row.segments);
        const metrics = asObject(row.metrics);
        const campaignId = text(campaign.id);
        const metricDate = text(segments.date) || dates.previous;
        const result = await upsertPortfolioAdMetric(env, {
          metric_date: metricDate, platform: "Google Ads", account_id: customerId, campaign_id: campaignId,
          campaign_name: text(campaign.name), impressions: Number(metrics.impressions ?? 0), clicks: Number(metrics.clicks ?? 0),
          spend: Number(metrics.costMicros ?? 0) / 1_000_000, conversions: Number(metrics.conversions ?? 0),
          conversion_value: Number(metrics.conversionsValue ?? 0), currency_code: "USD",
          mapping_keys: [
            { platform: "Google", external_type: "customer_id", external_id: customerId },
            { platform: "Google", external_type: "campaign_id", external_id: campaignId },
          ],
        });
        if (result.inserted === true) inserted += 1; else updated += 1;
        if (result.unmapped === true) unmapped += 1;
        recordsQueued += 1;
      }
    }
  }
  await recordIntegrationSyncRun(env, { id: runId, provider: "google_ads", sync_kind: "metrics", status: "succeeded", started_at: startedAt,
    finished_at: new Date().toISOString(), records_received: recordsQueued, records_inserted: inserted, records_updated: updated, records_unmapped: unmapped });
  return { source: "Google Ads", accounts: customerIds.length, recordsQueued, skipped: false };
  } catch (error) {
    await recordIntegrationSyncRun(env, { id: runId, provider: "google_ads", sync_kind: "metrics", status: "failed", started_at: startedAt,
      finished_at: new Date().toISOString(), records_received: recordsQueued, records_inserted: inserted, records_updated: updated, records_unmapped: unmapped,
      failure_details: [{ reason: error instanceof Error ? error.message : "unknown" }] });
    throw error;
  }
}

export async function fetchMetaLead(env: RuntimeEnv, notice: MetaLeadNotification, requestId: string = crypto.randomUUID()): Promise<CanonicalProviderEvent> {
  if (!env.META_PAGE_ACCESS_TOKEN) throw new Error("missing_secret:META_PAGE_ACCESS_TOKEN");
  const fields = "created_time,id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data";
  const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${notice.externalId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(env.META_PAGE_ACCESS_TOKEN)}`);
  const payload = await response.json<JsonObject>();
  if (!response.ok) throw new Error(`meta_lead_${response.status}`);
  const answers = metaFieldMap(payload.field_data);
  return canonicalMetaLeadEvent(payload, notice, answers, requestId, env.DRY_RUN === "true");
}

export async function syncMetaAds(env: RuntimeEnv): Promise<SyncSummary> {
  const accountIds = splitCsv(env.META_AD_ACCOUNT_IDS);
  if (!accountIds.length) {
    await recordIntegrationSyncRun(env, { provider: "meta_ads", sync_kind: "metrics", status: "failed", finished_at: new Date().toISOString(), failure_details: [{ reason: "no_account_ids" }] });
    return { source: "Meta Ads", accounts: 0, recordsQueued: 0, skipped: true, reason: "no_account_ids" };
  }
  if (!env.META_PAGE_ACCESS_TOKEN) {
    await recordIntegrationSyncRun(env, { provider: "meta_ads", sync_kind: "metrics", status: "failed", finished_at: new Date().toISOString(), failure_details: [{ reason: "missing_credentials" }] });
    return { source: "Meta Ads", accounts: accountIds.length, recordsQueued: 0, skipped: true, reason: "missing_credentials" };
  }
  const dates = metricDatesUtc();
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await recordIntegrationSyncRun(env, { id: runId, provider: "meta_ads", sync_kind: "metrics", status: "running", started_at: startedAt });
  let recordsQueued = 0;
  let inserted = 0;
  let updated = 0;
  let unmapped = 0;
  try {
  for (const accountId of accountIds) {
    const params = new URLSearchParams({
      access_token: env.META_PAGE_ACCESS_TOKEN,
      level: "campaign",
      fields: "account_id,campaign_id,campaign_name,date_start,date_stop,impressions,clicks,spend,actions,action_values",
      time_range: JSON.stringify({ since: dates.previous, until: dates.today }),
      time_increment: "1",
      limit: "500",
    });
    let nextUrl: string | undefined = `https://graph.facebook.com/${env.META_GRAPH_VERSION}/act_${accountId}/insights?${params}`;
    while (nextUrl) {
      const response: Response = await fetch(nextUrl);
      const payload = (await response.json()) as JsonObject;
      if (!response.ok) throw new Error(`meta_ads_${response.status}`);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      for (const rowValue of rows) {
        const row = asObject(rowValue);
        const campaignId = text(row.campaign_id);
        const metricDate = text(row.date_start) || dates.previous;
        const actions = Array.isArray(row.actions) ? row.actions.map(asObject) : [];
        const conversions = actions.filter((item) => /lead|purchase|schedule/.test(text(item.action_type))).reduce((sum, item) => sum + Number(item.value ?? 0), 0);
        const result = await upsertPortfolioAdMetric(env, {
          metric_date: metricDate, platform: "Meta Ads", account_id: accountId, campaign_id: campaignId,
          campaign_name: text(row.campaign_name), impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0),
          spend: Number(row.spend ?? 0), conversions, conversion_value: 0, currency_code: "USD",
          mapping_keys: [
            { platform: "Meta", external_type: "ad_account_id", external_id: accountId },
            { platform: "Meta", external_type: "campaign_id", external_id: campaignId },
          ],
        });
        if (result.inserted === true) inserted += 1; else updated += 1;
        if (result.unmapped === true) unmapped += 1;
        recordsQueued += 1;
      }
      nextUrl = text(asObject(payload.paging).next) || undefined;
    }
  }
  await recordIntegrationSyncRun(env, { id: runId, provider: "meta_ads", sync_kind: "metrics", status: "succeeded", started_at: startedAt,
    finished_at: new Date().toISOString(), records_received: recordsQueued, records_inserted: inserted, records_updated: updated, records_unmapped: unmapped });
  return { source: "Meta Ads", accounts: accountIds.length, recordsQueued, skipped: false };
  } catch (error) {
    await recordIntegrationSyncRun(env, { id: runId, provider: "meta_ads", sync_kind: "metrics", status: "failed", started_at: startedAt,
      finished_at: new Date().toISOString(), records_received: recordsQueued, records_inserted: inserted, records_updated: updated, records_unmapped: unmapped,
      failure_details: [{ reason: error instanceof Error ? error.message : "unknown" }] });
    throw error;
  }
}
