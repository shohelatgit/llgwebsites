export interface WeightedRoutingRule {
  id: string;
  splitUnits: number;
  priority?: number;
  active: boolean;
  paused: boolean;
  eligibility: "Eligible" | "Paused" | "At Cap" | "Needs Review" | "Inactive";
  remainingCapacity?: number;
}

export interface RouteSelection {
  ruleId: string;
  position: number;
  cycleSize: number;
  cycleNumber: number;
}

interface CycleCandidate {
  id: string;
  weight: number;
  priority: number;
  currentWeight: number;
}

function effectiveWeight(rule: WeightedRoutingRule): number {
  const units = Math.max(0, Math.trunc(rule.splitUnits));
  if (rule.remainingCapacity === undefined) return units;
  return Math.min(units, Math.max(0, Math.trunc(rule.remainingCapacity)));
}

export function eligibleRoutingRules(rules: WeightedRoutingRule[]): WeightedRoutingRule[] {
  return rules.filter((rule) =>
    Boolean(rule.id)
    && rule.active
    && !rule.paused
    && rule.eligibility === "Eligible"
    && effectiveWeight(rule) > 0,
  );
}

/**
 * Builds one deterministic smooth weighted-round-robin cycle.
 * A 5/5 split produces ten slots with exactly five for each rule while
 * alternating them as evenly as possible instead of batching five at a time.
 */
export function buildWeightedCycle(rules: WeightedRoutingRule[]): string[] {
  const candidates: CycleCandidate[] = eligibleRoutingRules(rules)
    .map((rule) => ({
      id: rule.id,
      weight: effectiveWeight(rule),
      priority: Number.isFinite(rule.priority) ? Number(rule.priority) : 100,
      currentWeight: 0,
    }))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));

  const cycleSize = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (!cycleSize) return [];

  const cycle: string[] = [];
  for (let position = 0; position < cycleSize; position += 1) {
    for (const candidate of candidates) candidate.currentWeight += candidate.weight;
    const winner = candidates.reduce((best, candidate) => {
      if (candidate.currentWeight !== best.currentWeight) {
        return candidate.currentWeight > best.currentWeight ? candidate : best;
      }
      if (candidate.priority !== best.priority) return candidate.priority < best.priority ? candidate : best;
      return candidate.id.localeCompare(best.id) < 0 ? candidate : best;
    });
    winner.currentWeight -= cycleSize;
    cycle.push(winner.id);
  }
  return cycle;
}

export function routingRulesFingerprint(rules: WeightedRoutingRule[]): string {
  return eligibleRoutingRules(rules)
    .map((rule) => `${rule.id}:${effectiveWeight(rule)}:${rule.priority ?? 100}`)
    .sort()
    .join("|");
}
