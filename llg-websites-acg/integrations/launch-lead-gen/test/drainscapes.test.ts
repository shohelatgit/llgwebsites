import { describe, expect, it } from "vitest";
import { allocateBudget, boundedBudget, scoreMarket, type DrainscapesMarket, type WeatherSignal } from "../src/drainscapes";

function market(overrides: Partial<DrainscapesMarket> = {}): DrainscapesMarket {
  return {
    market_id: 1, market_key: "drainscapes:state:MO", name: "Missouri", state_region: "MO",
    timezone: "America/Chicago", latitude: 38.45, longitude: -92.29, owned: true,
    fulfillment_enabled: true, capacity_leads_per_day: 10, priority_weight: 1, target_cpl: 125,
    minimum_daily_budget: 25, maximum_daily_budget: 500, google_ads_customer_id: null,
    google_ads_campaign_id: null, google_ads_budget_resource_name: null, pause_reason: null,
    observed_cpl: null, spend_30d: 0, conversions_30d: 0, last_recommended_daily_budget: null,
    ...overrides,
  };
}

function weather(score: number): WeatherSignal {
  return {
    observed_at: "2026-08-17T12:00:00.000Z", source: "weather.gov", precipitation_probability: score / 100,
    forecast_precipitation_mm: score / 2, flood_alert_count: 0, severe_alert_count: 0,
    weather_score: score, source_summary: { status: "current" },
  };
}

describe("Drainscapes demand allocation", () => {
  it("makes fulfillment a hard zero-score gate", () => {
    expect(scoreMarket(market({ fulfillment_enabled: false }), weather(100), 10).score).toBe(0);
    expect(scoreMarket(market({ capacity_leads_per_day: 0 }), weather(100), 10).score).toBe(0);
  });

  it("increases opportunity when rainfall demand increases", () => {
    const dry = scoreMarket(market(), weather(0), 10);
    const wet = scoreMarket(market(), weather(85), 10);
    expect(wet.score).toBeGreaterThan(dry.score * 3);
  });

  it("never exceeds the national budget or a market cap", () => {
    const rows = [
      scoreMarket(market({ market_id: 1, maximum_daily_budget: 60 }), weather(90), 20),
      scoreMarket(market({ market_id: 2, maximum_daily_budget: 500 }), weather(30), 20),
    ];
    const allocation = allocateBudget(rows, 200, 0.05);
    expect(allocation.get(1)).toBeLessThanOrEqual(60);
    expect([...allocation.values()].reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(200.01);
  });

  it("trims cent rounding without crossing the hard national cap", () => {
    const rows = [1, 2, 3].map((marketId) => scoreMarket(market({ market_id: marketId, minimum_daily_budget: 0 }), weather(50), 30));
    const allocation = allocateBudget(rows, 100, 0.05);
    expect([...allocation.values()].reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(100);
  });

  it("ramps live budget changes within the configured guardrail", () => {
    expect(boundedBudget(200, 100, 0.25)).toBe(125);
    expect(boundedBudget(20, 100, 0.25)).toBe(75);
  });
});
