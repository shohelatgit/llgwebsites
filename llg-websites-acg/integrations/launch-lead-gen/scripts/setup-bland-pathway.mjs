const apiKey = process.env.BLAND_API_KEY;
if (!apiKey) throw new Error("BLAND_API_KEY is required");

const baseUrl = "https://api.bland.ai/v1";
const pathwayName = "LLG Universal Lead Qualification - Staging";
const description = "Unpublished shared staging flow. Company, services, service areas, availability, voice, and lead identity are supplied dynamically from Supabase.";

async function bland(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Bland ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

function flattenPathways(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => Array.isArray(item) ? item : [item]);
}

const existing = flattenPathways(await bland("/pathway"));
let pathwayId = existing.find((item) => item?.name === pathwayName)?.id;
if (!pathwayId) {
  const created = await bland("/pathway/create", {
    method: "POST",
    body: JSON.stringify({ name: pathwayName, description }),
  });
  pathwayId = created.pathway_id ?? created.data?.pathway_id ?? created.id;
}
if (!pathwayId) throw new Error("Bland did not return a pathway ID");

const nodes = [
  {
    globalConfig: {
      globalPrompt: "You are a concise, warm AI intake assistant for {{company_display_name}}. Never claim to be human. Use only supplied company facts, services, service areas, availability, and transfer settings. Ask one question at a time. Never invent coverage, price, availability, licensing, warranties, appointment times, or response times. Respect opt-outs immediately. For a life-safety emergency, tell the caller to contact 911 or the appropriate emergency utility and end the call. This is a lead qualification call, not a guarantee that the local provider will accept the project.",
    },
    position: { x: 0, y: -160 },
  },
  {
    id: "start",
    type: "Default",
    position: { x: 0, y: 0 },
    data: {
      name: "AI disclosure and greeting",
      isStart: true,
      prompt: "Greet the caller for {{company_display_name}}. Clearly state that you are an AI assistant using {{ai_disclosure}}. Ask how you can help today.",
      extractVars: [
        ["opt_out", "boolean", "True if the caller asks not to be contacted or asks to stop."],
        ["emergency", "boolean", "True for an immediate threat to life, active fire, gas leak, or similar emergency."],
      ],
    },
  },
  {
    id: "intake",
    type: "Default",
    position: { x: 320, y: 0 },
    data: {
      name: "Qualify project",
      prompt: "Collect the lead details naturally, one question at a time. Confirm the requested service against {{service_names}} without inventing capabilities. Collect full name, callback number, service address and postal code, city/state, property ownership, project timeline, approximate budget, concise project description, preferred contact time, and email only if comfortable sharing it. If this is an outbound call, confirm contact consent.",
      extractVars: [
        ["caller_name", "string", "Caller full name."],
        ["callback_number", "string", "Confirmed callback phone in E.164 when possible."],
        ["email", "string", "Email if voluntarily provided."],
        ["caller_address", "string", "Service street address."],
        ["city", "string", "Service city."],
        ["state_region", "string", "Service state or region."],
        ["postal_code", "string", "Service postal code."],
        ["service_interest", "string", "Requested service."],
        ["property_ownership", "string", "Owner, renter, buying, or other."],
        ["project_timeline", "string", "Requested project timing."],
        ["budget_range", "string", "Approximate budget range."],
        ["project_description", "string", "Concise description of the project."],
        ["preferred_contact_time", "string", "Preferred follow-up time."],
        ["contact_consent", "boolean", "Whether the caller consents to follow-up contact."],
        ["opt_out", "boolean", "Whether the caller opted out."],
        ["emergency", "boolean", "Whether this is an emergency."],
      ],
    },
  },
  {
    id: "coverage",
    type: "Default",
    position: { x: 640, y: 0 },
    data: {
      name: "Check service and area",
      prompt: "Compare the requested service only with {{service_names}} and the location only with {{service_areas}}. If either data set is missing or unclear, choose needs review. Do not tell the caller they are definitely covered unless the supplied data supports it.",
      extractVars: [
        ["service_area_match", "string", "yes, no, or unknown based only on supplied service areas."],
        ["qualification_status", "string", "qualified, needs_review, or unqualified."],
        ["disqualification_reason", "string", "Reason if clearly unqualified."],
        ["needs_human_followup", "boolean", "True when data is unclear or a person should review."],
      ],
    },
  },
  {
    id: "confirm",
    type: "Default",
    position: { x: 960, y: 0 },
    data: {
      name: "Confirm captured details",
      prompt: "Briefly summarize the caller name, callback number, location, requested service, timeline, budget, and project description. Ask the caller to confirm or correct the details. If after hours, follow {{after_hours_behavior}} without promising an exact callback time.",
    },
  },
  {
    id: "transfer",
    type: "Transfer Call",
    position: { x: 1280, y: -120 },
    data: {
      name: "Optional approved transfer",
      transferNumber: "{{transfer_phone}}",
      prompt: "Transfer only because {{allow_transfer}} is true and a transfer number is present.",
    },
  },
  {
    id: "complete",
    type: "End Call",
    position: { x: 1280, y: 80 },
    data: {
      name: "Normal completion",
      prompt: "Thank the caller. State that the local provider will review the request and follow up. Do not imply the project has been accepted or an appointment is booked.",
    },
  },
  {
    id: "review",
    type: "End Call",
    position: { x: 960, y: 240 },
    data: {
      name: "Manual review completion",
      prompt: "Thank the caller. Explain that the details need review and someone will follow up if the local provider can help. Do not promise service coverage.",
    },
  },
  {
    id: "out_of_area",
    type: "End Call",
    position: { x: 640, y: 300 },
    data: {
      name: "Out of area",
      prompt: "Politely explain that the supplied service-area information does not show coverage for the location. Do not offer unrelated providers or make a promise.",
    },
  },
  {
    id: "opt_out",
    type: "End Call",
    position: { x: 320, y: -280 },
    data: {
      name: "Opt out",
      prompt: "Confirm the opt-out briefly, apologize for the interruption, and end immediately. Do not ask additional qualifying questions.",
    },
  },
  {
    id: "emergency",
    type: "End Call",
    position: { x: 320, y: 280 },
    data: {
      name: "Emergency",
      prompt: "Tell the caller to contact 911 or the appropriate emergency utility immediately. State that this intake line cannot provide emergency response, then end the call.",
    },
  },
];

const edges = [
  { id: "start-optout", source: "start", target: "opt_out", label: "Caller opts out or asks to stop." },
  { id: "start-emergency", source: "start", target: "emergency", label: "Immediate emergency or threat to life/property." },
  { id: "start-intake", source: "start", target: "intake", label: "Normal service inquiry." },
  { id: "intake-optout", source: "intake", target: "opt_out", label: "Caller opts out at any point." },
  { id: "intake-emergency", source: "intake", target: "emergency", label: "Emergency is identified." },
  { id: "intake-coverage", source: "intake", target: "coverage", label: "Required details have been collected or caller declines optional fields." },
  { id: "coverage-out", source: "coverage", target: "out_of_area", label: "Service area match is no." },
  { id: "coverage-review", source: "coverage", target: "review", label: "Service, area, or qualification is unclear and needs human review." },
  { id: "coverage-confirm", source: "coverage", target: "confirm", label: "The request is qualified based on supplied data." },
  { id: "confirm-transfer", source: "confirm", target: "transfer", label: "Caller requests transfer, allow_transfer is true, and transfer_phone is present." },
  { id: "confirm-complete", source: "confirm", target: "complete", label: "Details are confirmed and no approved transfer is requested." },
];

const updated = await bland(`/pathway/${pathwayId}`, {
  method: "POST",
  body: JSON.stringify({ name: pathwayName, description, nodes, edges }),
});

console.log(JSON.stringify({
  pathway_id: pathwayId,
  status: updated.status,
  message: updated.message,
  node_count: updated.pathway_data?.nodes?.length ?? nodes.length,
  edge_count: updated.pathway_data?.edges?.length ?? edges.length,
  published: false,
}));
