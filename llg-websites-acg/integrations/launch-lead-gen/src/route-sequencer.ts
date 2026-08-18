import { DurableObject } from "cloudflare:workers";
import { buildWeightedCycle, routingRulesFingerprint } from "./routing";
import type { RouteSelection, WeightedRoutingRule } from "./routing";

interface StateRow {
  [key: string]: string | number;
  fingerprint: string;
  position: number;
  cycle_number: number;
}

export class RouteSequencer extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS routing_state (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          fingerprint TEXT NOT NULL,
          position INTEGER NOT NULL,
          cycle_number INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    });
  }

  next(rules: WeightedRoutingRule[]): RouteSelection {
    const cycle = buildWeightedCycle(rules);
    if (!cycle.length) throw new Error("no_eligible_routing_rules");

    const fingerprint = routingRulesFingerprint(rules);
    const stored = this.ctx.storage.sql.exec<StateRow>(
      "SELECT fingerprint, position, cycle_number FROM routing_state WHERE singleton = 1",
    ).toArray()[0];
    const position = stored?.fingerprint === fingerprint && stored.position < cycle.length
      ? stored.position
      : 0;
    const cycleNumber = stored?.fingerprint === fingerprint ? stored.cycle_number : 0;
    const nextPosition = (position + 1) % cycle.length;
    const nextCycleNumber = cycleNumber + (nextPosition === 0 ? 1 : 0);

    this.ctx.storage.sql.exec(
      `INSERT INTO routing_state (singleton, fingerprint, position, cycle_number, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET
         fingerprint = excluded.fingerprint,
         position = excluded.position,
         cycle_number = excluded.cycle_number,
         updated_at = excluded.updated_at`,
      fingerprint,
      nextPosition,
      nextCycleNumber,
      new Date().toISOString(),
    );

    return {
      ruleId: cycle[position] ?? "",
      position,
      cycleSize: cycle.length,
      cycleNumber,
    };
  }

  reset(): void {
    this.ctx.storage.sql.exec("DELETE FROM routing_state");
  }
}
