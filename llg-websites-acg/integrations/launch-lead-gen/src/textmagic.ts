import type { RuntimeEnv } from "./types";

function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    const normalized = typeof value === "string" ? value : value.name;
    const existing = result[key];
    if (existing === undefined) result[key] = normalized;
    else if (Array.isArray(existing)) existing.push(normalized);
    else result[key] = [existing, normalized];
  }
  return result;
}

export async function parseTextMagicCallback(raw: ArrayBuffer, contentType: string): Promise<Record<string, unknown>> {
  const replay = new Request("https://local.invalid", {
    method: "POST",
    headers: { "content-type": contentType || "application/x-www-form-urlencoded" },
    body: raw,
  });
  if (contentType.toLowerCase().includes("application/json")) {
    const parsed: unknown = await replay.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_textmagic_payload");
    return parsed as Record<string, unknown>;
  }
  return formDataToObject(await replay.formData());
}

export async function sendTextMagicMessage(
  env: RuntimeEnv,
  phone: string,
  message: string,
  from: string = env.TEXTMAGIC_DEFAULT_FROM || "",
): Promise<Record<string, unknown>> {
  if (!env.TEXTMAGIC_USERNAME || !env.TEXTMAGIC_API_KEY) throw new Error("textmagic_not_configured");
  const body = new URLSearchParams({ phones: phone, text: message });
  if (from) body.set("from", from);
  const response = await fetch("https://rest.textmagic.com/api/v2/messages", {
    method: "POST",
    headers: {
      "X-TM-Username": env.TEXTMAGIC_USERNAME,
      "X-TM-Key": env.TEXTMAGIC_API_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const parsed: unknown = await response.json();
  if (!response.ok || !parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`textmagic_send_${response.status}`);
  }
  return parsed as Record<string, unknown>;
}

export function getTextMagicMessageId(result: Record<string, unknown>): string {
  const candidates = [result.id, result.messageId, result.message_id];
  const nested = result.message;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const message = nested as Record<string, unknown>;
    candidates.push(message.id, message.messageId, message.message_id);
  }
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  throw new Error("textmagic_missing_message_id");
}
