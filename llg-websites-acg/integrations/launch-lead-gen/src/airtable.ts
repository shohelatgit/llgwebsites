import type { AirtableFieldValue, DailyMetricMessage, LeadMessage, RuntimeEnv } from "./types";
import type { WeightedRoutingRule } from "./routing";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records?: AirtableRecord[];
  offset?: string;
  error?: { type?: string; message?: string };
}

export interface SourceMapping {
  propertyRecordId?: string;
  operatorRecordId?: string;
  propertySourceKey?: string;
  operatorSourceKey?: string;
}

export interface LeadUpsertResult {
  recordId?: string;
  mapping?: SourceMapping;
}

interface RoutingRule extends WeightedRoutingRule {
  routeGroup: string;
  clientRecordId: string;
  propertyRecordId?: string;
  deliveryChannel: string;
  commsAgentId?: string;
  commsRecipient?: string;
}

function requireSecret(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

function tableUrl(env: RuntimeEnv, table: string): string {
  return `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(table)}`;
}

function requestHeaders(env: RuntimeEnv): Record<string, string> {
  return {
    authorization: `Bearer ${requireSecret(env.AIRTABLE_ACCESS_TOKEN, "AIRTABLE_ACCESS_TOKEN")}`,
    "content-type": "application/json",
  };
}

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function upsert(
  env: RuntimeEnv,
  table: string,
  mergeField: string,
  fields: Record<string, AirtableFieldValue>,
): Promise<string | undefined> {
  if (env.DRY_RUN === "true") {
    console.log(JSON.stringify({ event: "airtable_dry_run", table, mergeField }));
    return undefined;
  }
  const response = await fetch(tableUrl(env, table), {
    method: "PATCH",
    headers: requestHeaders(env),
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn: [mergeField] },
      typecast: true,
      records: [{ fields }],
    }),
  });
  const detail = await response.json<AirtableResponse>().catch((): AirtableResponse => ({}));
  if (!response.ok) throw new Error(`airtable_${response.status}:${detail.error?.type ?? "unknown"}`);
  return detail.records?.[0]?.id;
}

async function updateRecord(
  env: RuntimeEnv,
  table: string,
  recordId: string,
  fields: Record<string, AirtableFieldValue>,
): Promise<void> {
  const response = await fetch(tableUrl(env, table), {
    method: "PATCH",
    headers: requestHeaders(env),
    body: JSON.stringify({ typecast: true, records: [{ id: recordId, fields }] }),
  });
  if (!response.ok) throw new Error(`airtable_update_${response.status}`);
}

async function findBySourceKey(
  env: RuntimeEnv,
  table: string,
  sourceKey: string,
  fields: string[],
): Promise<AirtableRecord | undefined> {
  const params = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: `{Source Key}='${escapeFormulaValue(sourceKey)}'`,
  });
  for (const field of fields) params.append("fields[]", field);
  const response = await fetch(`${tableUrl(env, table)}?${params}`, { headers: requestHeaders(env) });
  if (!response.ok) throw new Error(`airtable_lookup_${response.status}`);
  const payload = await response.json<AirtableResponse>();
  return payload.records?.[0];
}

export async function upsertLead(env: RuntimeEnv, message: LeadMessage): Promise<LeadUpsertResult> {
  if (env.DRY_RUN === "true") {
    const recordId = await upsert(env, env.AIRTABLE_LEADS_TABLE_ID, "Source Key", message.fields);
    return { recordId };
  }
  const mapping = await findSourceMapping(env, message.routingKeys);
  const fields = { ...message.fields };
  if (mapping) {
    if (mapping.propertyRecordId) fields["Assigned Property Record"] = [mapping.propertyRecordId];
    if (mapping.operatorRecordId) fields["Assigned Client Record"] = [mapping.operatorRecordId];
    if (mapping.propertySourceKey) fields["Property Source Key"] = mapping.propertySourceKey;
    if (mapping.operatorSourceKey) fields["Operator Source Key"] = mapping.operatorSourceKey;
    fields["Data Quality Status"] = "Matched";
    fields["Matching Confidence"] = "Exact";
  } else {
    fields["Data Quality Status"] = "Needs Review";
    fields["Matching Confidence"] = "Unmatched";
  }
  const recordId = await upsert(env, env.AIRTABLE_LEADS_TABLE_ID, "Source Key", fields);
  return { recordId, mapping };
}

export async function routeLead(
  env: RuntimeEnv,
  message: LeadMessage,
  result: LeadUpsertResult,
): Promise<void> {
  if (env.DRY_RUN === "true" || !result.recordId) return;
  if (!result.mapping?.propertyRecordId) {
    await updateRecord(env, env.AIRTABLE_LEADS_TABLE_ID, result.recordId, {
      "Routing Status": "Manual Review",
      "Delivery Status": "Not Ready",
    });
    return;
  }

  const deliverySourceKey = `delivery:${message.sourceKey}`;
  const existing = await findBySourceKey(
    env,
    env.AIRTABLE_LEAD_DELIVERIES_TABLE_ID,
    deliverySourceKey,
    ["Routing Rule", "Client", "Property", "Delivery Order", "Channel", "Queued At"],
  );

  let chosenRule: RoutingRule;
  let deliveryOrder: number;
  let splitBucket: string;
  let queuedAt = new Date().toISOString();
  if (existing) {
    const ruleId = recordLink(existing.fields["Routing Rule"]);
    const clientId = recordLink(existing.fields.Client);
    if (!ruleId || !clientId) throw new Error("existing_delivery_missing_links");
    chosenRule = {
      id: ruleId,
      routeGroup: "existing",
      clientRecordId: clientId,
      propertyRecordId: recordLink(existing.fields.Property),
      splitUnits: 1,
      active: true,
      paused: false,
      eligibility: "Eligible",
      deliveryChannel: String(existing.fields.Channel ?? "Airtable only"),
    };
    deliveryOrder = Number(existing.fields["Delivery Order"] ?? 1);
    splitBucket = String(deliveryOrder);
    queuedAt = String(existing.fields["Queued At"] ?? queuedAt);
  } else {
    const rules = await listRoutingRules(env, result.mapping.propertyRecordId);
    const routeGroups = [...new Set(rules.map((rule) => rule.routeGroup))];
    if (!rules.length) {
      await updateRecord(env, env.AIRTABLE_LEADS_TABLE_ID, result.recordId, {
        "Routing Status": "No Eligible Client",
        "Delivery Status": "Not Ready",
      });
      return;
    }
    if (routeGroups.length !== 1) {
      await updateRecord(env, env.AIRTABLE_LEADS_TABLE_ID, result.recordId, {
        "Routing Status": "Manual Review",
        "Delivery Status": "Not Ready",
      });
      return;
    }
    const selection = await env.ROUTE_SEQUENCER.getByName(routeGroups[0] ?? "unassigned").next(rules);
    const selected = rules.find((rule) => rule.id === selection.ruleId);
    if (!selected) throw new Error("selected_routing_rule_missing");
    chosenRule = selected;
    deliveryOrder = selection.position + 1;
    splitBucket = `${selection.position + 1}/${selection.cycleSize}`;
  }

  await upsert(env, env.AIRTABLE_LEAD_DELIVERIES_TABLE_ID, "Source Key", {
    "Delivery ID": deliverySourceKey,
    Lead: [result.recordId],
    "Routing Rule": [chosenRule.id],
    Client: [chosenRule.clientRecordId],
    ...(chosenRule.propertyRecordId ? { Property: [chosenRule.propertyRecordId] } : {}),
    "Delivery Order": deliveryOrder,
    Exclusivity: "Exclusive",
    Channel: chosenRule.deliveryChannel,
    Status: "Queued",
    "Queued At": queuedAt,
    Billable: true,
    Outcome: "Pending",
    "Source Key": deliverySourceKey,
  });

  await updateRecord(env, env.AIRTABLE_LEADS_TABLE_ID, result.recordId, {
    "Routing Rule": [chosenRule.id],
    "Assigned Client Record": [chosenRule.clientRecordId],
    ...(chosenRule.propertyRecordId ? { "Assigned Property Record": [chosenRule.propertyRecordId] } : {}),
    "Routing Status": "Routed",
    "Routed At": queuedAt,
    "Route Sequence": deliveryOrder,
    "Split Bucket": splitBucket,
    "Delivery Status": "Pending",
  });

  const communicationSourceKey = `communication:${message.sourceKey}`;
  await upsert(env, env.AIRTABLE_CLIENT_COMMUNICATIONS_TABLE_ID, "Source Key", {
    "Communication ID": communicationSourceKey,
    Client: [chosenRule.clientRecordId],
    Lead: [result.recordId],
    ...(chosenRule.propertyRecordId ? { Property: [chosenRule.propertyRecordId] } : {}),
    "Communication Type": "Lead Delivery",
    Channel: chosenRule.deliveryChannel,
    ...(chosenRule.commsRecipient ? { "Recipient Phone": chosenRule.commsRecipient } : {}),
    Status: "Queued",
    ...(chosenRule.commsAgentId ? { "Comms Agent ID": chosenRule.commsAgentId } : {}),
    Trigger: "Lead routed",
    Template: "New lead delivery",
    "Message Summary": "New lead queued for client delivery.",
    "Scheduled At": queuedAt,
    "Source Key": communicationSourceKey,
  });
}

export async function upsertDailyMetric(env: RuntimeEnv, message: DailyMetricMessage): Promise<void> {
  await upsert(env, env.AIRTABLE_METRICS_TABLE, "Metric Key", message.fields);
}

async function findSourceMapping(env: RuntimeEnv, routingKeys: string[]): Promise<SourceMapping | undefined> {
  if (!routingKeys.length) return undefined;
  for (const routingKey of routingKeys) {
    const params = new URLSearchParams({
      maxRecords: "1",
      filterByFormula: `AND({Mapping Key}='${escapeFormulaValue(routingKey)}',{Active}=TRUE())`,
    });
    for (const field of ["Property", "Operator / Client", "Property Source Key", "Operator Source Key"]) {
      params.append("fields[]", field);
    }
    const response = await fetch(`${tableUrl(env, env.AIRTABLE_MAPPINGS_TABLE)}?${params}`, { headers: requestHeaders(env) });
    if (!response.ok) throw new Error(`airtable_mapping_${response.status}`);
    const payload = await response.json<AirtableResponse>();
    const fields = payload.records?.[0]?.fields;
    if (!fields) continue;
    return {
      propertyRecordId: recordLink(fields.Property),
      operatorRecordId: recordLink(fields["Operator / Client"]),
      propertySourceKey: String(fields["Property Source Key"] ?? "") || undefined,
      operatorSourceKey: String(fields["Operator Source Key"] ?? "") || undefined,
    };
  }
  return undefined;
}

async function listRoutingRules(env: RuntimeEnv, propertyRecordId: string): Promise<RoutingRule[]> {
  const fields = [
    "Route Group",
    "Client",
    "Property",
    "Split Units",
    "Priority",
    "Remaining Capacity",
    "Eligibility",
    "Active",
    "Paused",
    "Delivery Channel",
    "Comms Agent ID",
    "Comms Recipient",
  ];
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    for (const field of fields) params.append("fields[]", field);
    if (offset) params.set("offset", offset);
    const response = await fetch(`${tableUrl(env, env.AIRTABLE_ROUTING_RULES_TABLE_ID)}?${params}`, { headers: requestHeaders(env) });
    if (!response.ok) throw new Error(`airtable_routing_rules_${response.status}`);
    const payload = await response.json<AirtableResponse>();
    records.push(...(payload.records ?? []));
    offset = payload.offset;
  } while (offset);

  return records.flatMap((record): RoutingRule[] => {
    const clientRecordId = recordLink(record.fields.Client);
    const propertyIds = recordLinks(record.fields.Property);
    const routeGroup = String(record.fields["Route Group"] ?? "").trim();
    if (!clientRecordId || !routeGroup || !propertyIds.includes(propertyRecordId)) return [];
    const remainingRaw = record.fields["Remaining Capacity"];
    return [{
      id: record.id,
      routeGroup,
      clientRecordId,
      propertyRecordId: propertyIds[0],
      splitUnits: Number(record.fields["Split Units"] ?? 0),
      priority: Number(record.fields.Priority ?? 100),
      active: record.fields.Active === true,
      paused: record.fields.Paused === true,
      eligibility: String(record.fields.Eligibility ?? "Needs Review") as RoutingRule["eligibility"],
      remainingCapacity: remainingRaw === undefined ? undefined : Number(remainingRaw),
      deliveryChannel: String(record.fields["Delivery Channel"] ?? "Airtable only"),
      commsAgentId: String(record.fields["Comms Agent ID"] ?? "") || undefined,
      commsRecipient: String(record.fields["Comms Recipient"] ?? "") || undefined,
    }];
  });
}

function recordLinks(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function recordLink(value: unknown): string | undefined {
  return recordLinks(value)[0];
}
