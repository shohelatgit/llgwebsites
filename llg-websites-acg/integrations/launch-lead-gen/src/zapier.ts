import type { CanonicalFilloutSubmission, FilloutIngestResult, PilotLeadMessage, RuntimeEnv } from "./types";

export function pilotSiteKeys(env: RuntimeEnv): Set<string> {
  return new Set((env.PILOT_SITE_KEYS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

export function buildPilotLeadMessage(
  formId: string,
  submission: CanonicalFilloutSubmission,
  result: FilloutIngestResult,
): PilotLeadMessage {
  return {
    kind: "pilot-lead",
    idempotencyKey: `fillout:${submission.submissionId}`,
    leadPublicId: result.leadPublicId,
    propertyKey: submission.propertyKey,
    formId,
    submissionId: submission.submissionId,
    submittedAt: submission.submissionTime,
    testMode: result.testMode,
    contact: {
      fullName: submission.fullName,
      phone: submission.phone,
      email: submission.email,
      addressLine1: submission.addressLine1,
      addressLine2: submission.addressLine2,
      city: submission.city,
      stateRegion: submission.stateRegion,
      postalCode: submission.postalCode,
    },
    message: submission.message,
    answers: submission.answers,
    attribution: submission.attribution,
  };
}

export async function deliverPilotLeadToZapier(env: RuntimeEnv, message: PilotLeadMessage): Promise<void> {
  if (!env.ZAPIER_CATCH_HOOK_URL) {
    console.log(JSON.stringify({ event: "zapier_delivery_skipped", reason: "not_configured", leadPublicId: message.leadPublicId }));
    return;
  }

  const endpoint = new URL(env.ZAPIER_CATCH_HOOK_URL);
  if (endpoint.protocol !== "https:") throw new Error("zapier_hook_must_use_https");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-llg-idempotency-key": message.idempotencyKey,
  };
  if (env.ZAPIER_DELIVERY_TOKEN) headers["x-llg-delivery-token"] = env.ZAPIER_DELIVERY_TOKEN;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`zapier_delivery_${response.status}`);

  console.log(JSON.stringify({
    event: "zapier_delivery_succeeded",
    leadPublicId: message.leadPublicId,
    propertyKey: message.propertyKey,
  }));
}
