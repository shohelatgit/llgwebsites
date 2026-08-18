import { applyGoogleMarketControl, googleAccessToken } from "./platforms";
import { getDrainscapesControllerState, recordDrainscapesAllocationRun, recordDrainscapesDailyReport } from "./supabase";
import type { RuntimeEnv } from "./types";

type JsonObject = Record<string, unknown>;

export interface DrainscapesControllerSettings {
  scoring_enabled: boolean;
  mutations_enabled: boolean;
  national_daily_budget: number;
  allocation_cadence_minutes: number;
  report_timezone: string;
  report_hour_local: number;
  max_budget_change_pct: number;
  minimum_opportunity_score: number;
}

export interface DrainscapesMarket {
  market_id: number;
  market_key: string;
  name: string;
  state_region: string;
  timezone: string;
  latitude: number;
  longitude: number;
  owned: boolean;
  fulfillment_enabled: boolean;
  capacity_leads_per_day: number;
  priority_weight: number;
  target_cpl: number;
  minimum_daily_budget: number;
  maximum_daily_budget: number;
  google_ads_customer_id: string | null;
  google_ads_campaign_id: string | null;
  google_ads_budget_resource_name: string | null;
  pause_reason: string | null;
  observed_cpl: number | null;
  spend_30d: number;
  conversions_30d: number;
  last_recommended_daily_budget: number | null;
}

export interface WeatherSignal {
  observed_at: string;
  source: "weather.gov";
  precipitation_probability: number;
  forecast_precipitation_mm: number;
  flood_alert_count: number;
  severe_alert_count: number;
  weather_score: number;
  source_summary: JsonObject;
}

export interface MarketAllocation {
  market_id: number;
  opportunity_score: number;
  recommended_daily_budget: number;
  previous_daily_budget: number | null;
  applied_daily_budget: number | null;
  decision: string;
  apply_status: "dry_run" | "applied" | "skipped" | "failed";
  factors: JsonObject;
  error_message?: string;
  weather: WeatherSignal;
}

const WEATHER_USER_AGENT = "DrainscapesDemandController/1.0 (https://drainscapes.com)";

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseController(value: unknown): DrainscapesControllerSettings {
  const row = object(value);
  return {
    scoring_enabled: row.scoring_enabled !== false,
    mutations_enabled: row.mutations_enabled === true,
    national_daily_budget: numeric(row.national_daily_budget),
    allocation_cadence_minutes: numeric(row.allocation_cadence_minutes, 15),
    report_timezone: text(row.report_timezone) || "America/New_York",
    report_hour_local: numeric(row.report_hour_local, 7),
    max_budget_change_pct: numeric(row.max_budget_change_pct, 0.25),
    minimum_opportunity_score: numeric(row.minimum_opportunity_score, 0.05),
  };
}

function parseMarket(value: unknown): DrainscapesMarket {
  const row = object(value);
  return {
    market_id: numeric(row.market_id), market_key: text(row.market_key), name: text(row.name), state_region: text(row.state_region),
    timezone: text(row.timezone), latitude: numeric(row.latitude), longitude: numeric(row.longitude), owned: row.owned === true,
    fulfillment_enabled: row.fulfillment_enabled === true, capacity_leads_per_day: numeric(row.capacity_leads_per_day),
    priority_weight: numeric(row.priority_weight, 1), target_cpl: numeric(row.target_cpl, 125),
    minimum_daily_budget: numeric(row.minimum_daily_budget), maximum_daily_budget: numeric(row.maximum_daily_budget, 1000),
    google_ads_customer_id: nullableText(row.google_ads_customer_id), google_ads_campaign_id: nullableText(row.google_ads_campaign_id),
    google_ads_budget_resource_name: nullableText(row.google_ads_budget_resource_name), pause_reason: nullableText(row.pause_reason),
    observed_cpl: row.observed_cpl === null || row.observed_cpl === undefined ? null : numeric(row.observed_cpl),
    spend_30d: numeric(row.spend_30d), conversions_30d: numeric(row.conversions_30d),
    last_recommended_daily_budget: row.last_recommended_daily_budget === null || row.last_recommended_daily_budget === undefined
      ? null : numeric(row.last_recommended_daily_budget),
  };
}

async function weatherJson(url: string): Promise<JsonObject> {
  const response = await fetch(url, {
    headers: { accept: "application/geo+json, application/json", "user-agent": WEATHER_USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`weather_gov_${response.status}`);
  return object(await response.json<unknown>());
}

function startsWithin24Hours(validTime: unknown, now: Date): boolean {
  const start = text(validTime).split("/")[0] || "";
  const timestamp = Date.parse(start);
  return Number.isFinite(timestamp) && timestamp >= now.getTime() - 60_000 && timestamp < now.getTime() + 86_400_000;
}

function gridValues(grid: JsonObject, key: string, now: Date): number[] {
  const property = object(object(grid.properties)[key]);
  const values = Array.isArray(property.values) ? property.values : [];
  return values
    .map(object)
    .filter((row) => startsWithin24Hours(row.validTime, now))
    .map((row) => numeric(row.value))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function emptyWeather(now: Date, reason: string): WeatherSignal {
  return {
    observed_at: now.toISOString(), source: "weather.gov", precipitation_probability: 0,
    forecast_precipitation_mm: 0, flood_alert_count: 0, severe_alert_count: 0, weather_score: 0,
    source_summary: { status: "unavailable", reason },
  };
}

export async function fetchWeatherSignal(market: DrainscapesMarket, now = new Date()): Promise<WeatherSignal> {
  try {
    const point = await weatherJson(`https://api.weather.gov/points/${market.latitude.toFixed(4)},${market.longitude.toFixed(4)}`);
    const gridUrl = text(object(point.properties).forecastGridData);
    if (!gridUrl.startsWith("https://api.weather.gov/")) throw new Error("weather_gov_missing_grid_url");
    const [grid, alerts] = await Promise.all([
      weatherJson(gridUrl),
      weatherJson(`https://api.weather.gov/alerts/active?point=${market.latitude.toFixed(4)},${market.longitude.toFixed(4)}`),
    ]);
    const probabilities = gridValues(grid, "probabilityOfPrecipitation", now);
    const precipitation = gridValues(grid, "quantitativePrecipitation", now);
    const alertRows = Array.isArray(alerts.features) ? alerts.features.map(object).map((feature) => object(feature.properties)) : [];
    const floodAlerts = alertRows.filter((row) => /flood/i.test(text(row.event))).length;
    const severeAlerts = alertRows.filter((row) => /extreme|severe/i.test(text(row.severity))).length;
    const probability = clamp((probabilities.length ? Math.max(...probabilities) : 0) / 100, 0, 1);
    const precipitationMm = precipitation.reduce((sum, value) => sum + value, 0);
    const weatherScore = clamp(probability * 35 + Math.min(precipitationMm / 50, 1) * 40 + Math.min(floodAlerts * 15, 30) + Math.min(severeAlerts * 5, 10), 0, 100);
    return {
      observed_at: now.toISOString(), source: "weather.gov", precipitation_probability: Number(probability.toFixed(3)),
      forecast_precipitation_mm: Number(precipitationMm.toFixed(3)), flood_alert_count: floodAlerts,
      severe_alert_count: severeAlerts, weather_score: Number(weatherScore.toFixed(4)),
      source_summary: { status: "current", active_alerts: alertRows.slice(0, 8).map((row) => ({ event: text(row.event), severity: text(row.severity) })) },
    };
  } catch (error) {
    return emptyWeather(now, error instanceof Error ? error.message : "unknown_weather_error");
  }
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, callback: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(values[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

interface ScoredMarket { market: DrainscapesMarket; weather: WeatherSignal; score: number; factors: JsonObject; maximum: number; }

export function scoreMarket(market: DrainscapesMarket, weather: WeatherSignal, totalCapacity: number): ScoredMarket {
  const capacityShare = totalCapacity > 0 ? market.capacity_leads_per_day / totalCapacity : 0;
  const cplEfficiency = market.observed_cpl && market.observed_cpl > 0 ? clamp(market.target_cpl / market.observed_cpl, 0.5, 1.5) : 1;
  const weatherMultiplier = 0.35 + weather.weather_score / 100 * 1.65;
  const score = market.fulfillment_enabled && market.capacity_leads_per_day > 0
    ? market.priority_weight * weatherMultiplier * (0.65 + capacityShare * 0.35) * cplEfficiency
    : 0;
  return {
    market, weather, score,
    maximum: Math.min(market.maximum_daily_budget, market.capacity_leads_per_day * market.target_cpl),
    factors: {
      weather_score: weather.weather_score, weather_multiplier: Number(weatherMultiplier.toFixed(4)),
      capacity_share: Number(capacityShare.toFixed(4)), cpl_efficiency: Number(cplEfficiency.toFixed(4)),
      priority_weight: market.priority_weight, target_cpl: market.target_cpl, observed_cpl: market.observed_cpl,
    },
  };
}

export function allocateBudget(scored: ScoredMarket[], budget: number, minimumScore: number): Map<number, number> {
  const allocation = new Map<number, number>(scored.map((row) => [row.market.market_id, 0]));
  const eligible = scored.filter((row) => row.score >= minimumScore && row.maximum > 0);
  if (!eligible.length || budget <= 0) return allocation;
  const usableBudget = Math.max(0, budget);
  const minimums = eligible.map((row) => Math.min(row.market.minimum_daily_budget, row.maximum));
  const minimumTotal = minimums.reduce((sum, value) => sum + value, 0);
  if (minimumTotal >= usableBudget) {
    eligible.forEach((row, index) => allocation.set(row.market.market_id, roundMoney(usableBudget * (minimums[index] || 0) / (minimumTotal || 1))));
    trimAllocationToBudget(allocation, usableBudget);
    return allocation;
  }
  eligible.forEach((row, index) => allocation.set(row.market.market_id, roundMoney(minimums[index] || 0)));
  let remaining = usableBudget - minimumTotal;
  let open = eligible.filter((row) => (allocation.get(row.market.market_id) || 0) < row.maximum);
  for (let pass = 0; pass < eligible.length && remaining > 0.009 && open.length; pass += 1) {
    const scoreTotal = open.reduce((sum, row) => sum + row.score, 0);
    let spent = 0;
    for (const row of open) {
      const current = allocation.get(row.market.market_id) || 0;
      const share = remaining * row.score / (scoreTotal || open.length);
      const addition = Math.min(share, row.maximum - current);
      allocation.set(row.market.market_id, roundMoney(current + addition));
      spent += addition;
    }
    remaining -= spent;
    open = open.filter((row) => (allocation.get(row.market.market_id) || 0) + 0.009 < row.maximum);
    if (spent < 0.009) break;
  }
  trimAllocationToBudget(allocation, usableBudget);
  return allocation;
}

function trimAllocationToBudget(allocation: Map<number, number>, budget: number): void {
  let excess = roundMoney([...allocation.values()].reduce((sum, value) => sum + value, 0) - budget);
  if (excess <= 0) return;
  for (const [marketId, value] of [...allocation.entries()].sort((a, b) => b[1] - a[1])) {
    const reduction = Math.min(value, excess);
    allocation.set(marketId, roundMoney(value - reduction));
    excess = roundMoney(excess - reduction);
    if (excess <= 0) break;
  }
}

export function boundedBudget(recommended: number, previous: number | null, maximumChangePct: number): number {
  if (previous === null || previous <= 0) return roundMoney(recommended);
  return roundMoney(clamp(recommended, previous * (1 - maximumChangePct), previous * (1 + maximumChangePct)));
}

function hasGoogleMapping(market: DrainscapesMarket): boolean {
  return Boolean(market.google_ads_customer_id && market.google_ads_campaign_id && market.google_ads_budget_resource_name);
}

function localDateAndHour(now: Date, timezone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value || "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

async function maybeStoreDailyReport(
  env: RuntimeEnv,
  controller: DrainscapesControllerSettings,
  latestReportDate: string,
  markets: DrainscapesMarket[],
  allocations: MarketAllocation[],
  now: Date,
): Promise<void> {
  const local = localDateAndHour(now, controller.report_timezone);
  if (local.hour !== controller.report_hour_local || latestReportDate === local.date) return;
  const enabled = markets.filter((market) => market.fulfillment_enabled);
  const reportPayload = {
    brand: "Drainscapes", report_date: local.date, generated_at: now.toISOString(),
    national_daily_budget: controller.national_daily_budget, enabled_markets: enabled.length,
    disabled_markets: markets.length - enabled.length,
    allocated_daily_budget: roundMoney(allocations.reduce((sum, row) => sum + row.recommended_daily_budget, 0)),
    top_markets: [...allocations].filter((row) => row.recommended_daily_budget > 0)
      .sort((a, b) => b.recommended_daily_budget - a.recommended_daily_budget).slice(0, 10)
      .map((row) => ({
        state: markets.find((market) => market.market_id === row.market_id)?.state_region,
        budget: row.recommended_daily_budget, score: row.opportunity_score,
        rainfall_mm: row.weather.forecast_precipitation_mm, flood_alerts: row.weather.flood_alert_count,
      })),
    warnings: allocations.filter((row) => row.error_message || object(row.weather.source_summary).status === "unavailable")
      .map((row) => ({ state: markets.find((market) => market.market_id === row.market_id)?.state_region, issue: row.error_message || object(row.weather.source_summary).reason })),
  };
  let deliveryChannel: "dashboard" | "webhook" = "dashboard";
  let deliveryStatus: "stored" | "sent" | "failed" = "stored";
  let errorMessage = "";
  if (String(env.DRAINSCAPES_REPORT_CHANNEL) === "webhook" && env.DRAINSCAPES_REPORT_WEBHOOK_URL) {
    deliveryChannel = "webhook";
    try {
      const headers: Record<string, string> = { "content-type": "application/json", "idempotency-key": `drainscapes-daily-${local.date}` };
      if (env.DRAINSCAPES_REPORT_WEBHOOK_TOKEN) headers.authorization = `Bearer ${env.DRAINSCAPES_REPORT_WEBHOOK_TOKEN}`;
      const response = await fetch(env.DRAINSCAPES_REPORT_WEBHOOK_URL, { method: "POST", headers, body: JSON.stringify(reportPayload) });
      if (!response.ok) throw new Error(`report_webhook_${response.status}`);
      deliveryStatus = "sent";
    } catch (error) {
      deliveryStatus = "failed";
      errorMessage = error instanceof Error ? error.message : "unknown_report_error";
    }
  }
  await recordDrainscapesDailyReport(env, {
    report_date: local.date, generated_at: now.toISOString(), timezone: controller.report_timezone,
    payload: reportPayload, delivery_channel: deliveryChannel, delivery_status: deliveryStatus,
    error_message: errorMessage || null,
  });
}

export async function runDrainscapesDemandController(env: RuntimeEnv, now = new Date()): Promise<JsonObject> {
  const state = await getDrainscapesControllerState(env);
  const controller = parseController(state.controller);
  const markets = (Array.isArray(state.markets) ? state.markets : []).map(parseMarket);
  const latestReportDate = text(state.latest_report_date);
  const runId = crypto.randomUUID();
  if (!controller.scoring_enabled) {
    await recordDrainscapesAllocationRun(env, {
      id: runId, calculated_at: now.toISOString(), national_daily_budget: controller.national_daily_budget,
      enabled_market_count: 0, allocated_daily_budget: 0, dry_run: true, status: "skipped", reason: "scoring_disabled",
    }, []);
    await maybeStoreDailyReport(env, controller, latestReportDate, markets, [], now);
    return { runId, status: "skipped", reason: "scoring_disabled" };
  }

  const enabledMarkets = markets.filter((market) => market.owned && market.fulfillment_enabled && market.capacity_leads_per_day > 0);
  const weatherSignals = await mapWithConcurrency(enabledMarkets, 4, (market) => fetchWeatherSignal(market, now));
  const weatherByMarket = new Map(enabledMarkets.map((market, index) => [market.market_id, weatherSignals[index]]));
  const totalCapacity = enabledMarkets.reduce((sum, market) => sum + market.capacity_leads_per_day, 0);
  const scored = enabledMarkets.map((market) => scoreMarket(market, weatherByMarket.get(market.market_id) || emptyWeather(now, "missing_weather_result"), totalCapacity));
  const budgetByMarket = allocateBudget(scored, controller.national_daily_budget, controller.minimum_opportunity_score);
  const liveMutationAllowed = String(env.DRY_RUN) === "false" && String(env.DELIVERY_ENABLED) === "true"
    && String(env.DRAINSCAPES_MUTATIONS_ENABLED) === "true" && controller.mutations_enabled;
  const marketsToRecord = markets.filter((market) => market.fulfillment_enabled || hasGoogleMapping(market));
  const scoredByMarket = new Map(scored.map((row) => [row.market.market_id, row]));
  const allocations: MarketAllocation[] = marketsToRecord.map((market) => {
    const row = scoredByMarket.get(market.market_id);
    const recommendation = market.fulfillment_enabled ? budgetByMarket.get(market.market_id) || 0 : 0;
    const mapped = hasGoogleMapping(market);
    return {
      market_id: market.market_id, opportunity_score: Number((row?.score || 0).toFixed(4)),
      recommended_daily_budget: recommendation, previous_daily_budget: market.last_recommended_daily_budget,
      applied_daily_budget: null,
      decision: !market.fulfillment_enabled ? "pause_fulfillment_off" : recommendation > 0 ? "allocate" : "hold_below_threshold",
      apply_status: liveMutationAllowed && mapped ? "skipped" : mapped ? "dry_run" : "skipped",
      factors: row?.factors || { fulfillment_enabled: market.fulfillment_enabled },
      ...(!mapped ? { error_message: "google_campaign_mapping_required" } : {}),
      weather: row?.weather || emptyWeather(now, market.fulfillment_enabled ? "missing_weather_result" : "fulfillment_off"),
    };
  });

  if (liveMutationAllowed) {
    const mapped = allocations.filter((allocation) => hasGoogleMapping(markets.find((market) => market.market_id === allocation.market_id)!));
    let accessToken: string | undefined;
    if (mapped.length) accessToken = await googleAccessToken(env);
    await mapWithConcurrency(mapped, 3, async (allocation) => {
      const market = markets.find((candidate) => candidate.market_id === allocation.market_id)!;
      try {
        const appliedBudget = market.fulfillment_enabled
          ? boundedBudget(allocation.recommended_daily_budget, allocation.previous_daily_budget, controller.max_budget_change_pct) : 0;
        await applyGoogleMarketControl(env, {
          customerId: market.google_ads_customer_id!, campaignId: market.google_ads_campaign_id!,
          budgetResourceName: market.google_ads_budget_resource_name!, fulfillmentEnabled: market.fulfillment_enabled && appliedBudget > 0,
          dailyBudget: appliedBudget,
        }, accessToken);
        allocation.applied_daily_budget = appliedBudget;
        allocation.apply_status = "applied";
      } catch (error) {
        allocation.apply_status = "failed";
        allocation.error_message = error instanceof Error ? error.message : "unknown_google_ads_error";
      }
      return allocation;
    });
  }

  const allocatedBudget = roundMoney(allocations.reduce((sum, row) => sum + row.recommended_daily_budget, 0));
  const failed = allocations.filter((row) => row.apply_status === "failed").length;
  const dryRun = !liveMutationAllowed;
  await recordDrainscapesAllocationRun(env, {
    id: runId, calculated_at: now.toISOString(), national_daily_budget: controller.national_daily_budget,
    enabled_market_count: enabledMarkets.length, allocated_daily_budget: allocatedBudget, dry_run: dryRun,
    status: failed ? "partial" : "succeeded", metadata: { weather_source: "weather.gov", failed_mutations: failed },
  }, allocations as unknown as Record<string, unknown>[]);
  await maybeStoreDailyReport(env, controller, latestReportDate, markets, allocations, now);
  return { runId, status: failed ? "partial" : "succeeded", enabledMarkets: enabledMarkets.length, allocatedBudget, dryRun };
}
