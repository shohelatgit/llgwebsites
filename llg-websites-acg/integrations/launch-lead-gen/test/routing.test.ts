import { describe, expect, it } from "vitest";
import { buildWeightedCycle, eligibleRoutingRules, routingRulesFingerprint } from "../src/routing";
import type { WeightedRoutingRule } from "../src/routing";

function rule(id: string, splitUnits: number, overrides: Partial<WeightedRoutingRule> = {}): WeightedRoutingRule {
  return {
    id,
    splitUnits,
    priority: 100,
    active: true,
    paused: false,
    eligibility: "Eligible",
    ...overrides,
  };
}

describe("weighted lead routing", () => {
  it("allocates exactly five of ten leads to each client", () => {
    const cycle = buildWeightedCycle([rule("client-a", 5), rule("client-b", 5)]);
    expect(cycle).toHaveLength(10);
    expect(cycle.filter((id) => id === "client-a")).toHaveLength(5);
    expect(cycle.filter((id) => id === "client-b")).toHaveLength(5);
    expect(cycle.slice(0, 4)).toEqual(["client-a", "client-b", "client-a", "client-b"]);
  });

  it("preserves an uneven seven-to-three split", () => {
    const cycle = buildWeightedCycle([rule("client-a", 7), rule("client-b", 3)]);
    expect(cycle.filter((id) => id === "client-a")).toHaveLength(7);
    expect(cycle.filter((id) => id === "client-b")).toHaveLength(3);
  });

  it("skips paused, inactive, capped, and zero-weight rules", () => {
    const rules = [
      rule("eligible", 2),
      rule("paused", 2, { paused: true }),
      rule("inactive", 2, { active: false }),
      rule("capped", 2, { eligibility: "At Cap" }),
      rule("zero", 0),
    ];
    expect(eligibleRoutingRules(rules).map((item) => item.id)).toEqual(["eligible"]);
    expect(buildWeightedCycle(rules)).toEqual(["eligible", "eligible"]);
  });

  it("limits a rule to its remaining cycle capacity", () => {
    const cycle = buildWeightedCycle([
      rule("limited", 5, { remainingCapacity: 2 }),
      rule("open", 5),
    ]);
    expect(cycle.filter((id) => id === "limited")).toHaveLength(2);
    expect(cycle.filter((id) => id === "open")).toHaveLength(5);
  });

  it("changes the fingerprint when a split changes", () => {
    expect(routingRulesFingerprint([rule("a", 5), rule("b", 5)]))
      .not.toBe(routingRulesFingerprint([rule("a", 6), rule("b", 4)]));
  });
});
