import { resolveCallRailCompanyPhoneNumbers, syncCallRailTrackerInventory } from "./supabase";
import type { CallRailInventorySummary, RuntimeEnv } from "./types";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function callRailRequest(env: RuntimeEnv, path: string): Promise<Record<string, unknown>> {
  if (!env.CALLRAIL_API_KEY) throw new Error("missing_secret:CALLRAIL_API_KEY");
  const response = await fetch(`https://api.callrail.com${path}`, {
    headers: {
      authorization: `Token token=${env.CALLRAIL_API_KEY}`,
      accept: "application/json",
      "user-agent": "llg-cloudflare-integrations/1.0",
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`callrail_api_${response.status}`);
  try {
    const parsed = objectValue(JSON.parse(body));
    if (!parsed) throw new Error("invalid_object");
    return parsed;
  } catch {
    throw new Error("callrail_api_invalid_response");
  }
}

async function fetchAllPages(
  env: RuntimeEnv,
  path: string,
  collectionKey: string,
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await callRailRequest(env, `${path}${separator}per_page=250&page=${page}`);
    const collection = Array.isArray(response[collectionKey]) ? response[collectionKey] : [];
    for (const item of collection) {
      const record = objectValue(item);
      if (record) records.push(record);
    }
    const totalPages = Number(response.total_pages) || 1;
    if (page >= totalPages) break;
  }
  return records;
}

export async function syncCallRailPhoneInventory(env: RuntimeEnv): Promise<CallRailInventorySummary> {
  const accounts = await fetchAllPages(env, "/v3/a.json", "accounts");
  const trackers: Record<string, unknown>[] = [];

  for (const account of accounts) {
    const accountId = typeof account.id === "string" ? account.id : "";
    if (!accountId) continue;
    const accountTrackers = await fetchAllPages(
      env,
      `/v3/a/${encodeURIComponent(accountId)}/trackers.json`,
      "trackers",
    );
    for (const tracker of accountTrackers) {
      trackers.push({
        ...tracker,
        account_id: accountId,
        account_name: typeof account.name === "string" ? account.name : "",
      });
    }
  }

  const stored = await syncCallRailTrackerInventory(env, trackers);
  const companyInferredNumbers = await resolveCallRailCompanyPhoneNumbers(env);
  return {
    accounts: accounts.length,
    trackersDiscovered: trackers.length,
    trackersUpserted: stored.trackersUpserted ?? 0,
    numbersSeen: stored.numbersSeen ?? 0,
    numbersMatched: stored.numbersMatched ?? 0,
    numbersUnmatched: stored.numbersUnmatched ?? 0,
    numberConflicts: stored.numberConflicts ?? 0,
    companyInferredNumbers,
  };
}
