const token = process.env.AIRTABLE_ACCESS_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID || "appMrG5ajs064I0L0";

if (!token) throw new Error("Set AIRTABLE_ACCESS_TOKEN with schema.bases:write for this one-time bootstrap.");

const headers = {
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
};

const tableDefinitions = [
  {
    name: "Daily Ad Metrics",
    fields: [
      { name: "Metric Key", type: "singleLineText" },
      { name: "Metric Date", type: "date", options: { dateFormat: { name: "iso" } } },
      { name: "Platform", type: "singleSelect", options: { choices: [{ name: "Google Ads" }, { name: "Meta Ads" }] } },
      { name: "Account ID", type: "singleLineText" },
      { name: "Campaign ID", type: "singleLineText" },
      { name: "Campaign Name", type: "singleLineText" },
      { name: "Campaign Status", type: "singleLineText" },
      { name: "Impressions", type: "number", options: { precision: 0 } },
      { name: "Clicks", type: "number", options: { precision: 0 } },
      { name: "Spend", type: "currency", options: { precision: 2, symbol: "$" } },
      { name: "Conversions", type: "number", options: { precision: 2 } },
      { name: "Conversion Value", type: "currency", options: { precision: 2, symbol: "$" } },
      { name: "Synced At", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "utc" } },
    ],
  },
  {
    name: "Source Mappings",
    fields: [
      { name: "Mapping Key", type: "singleLineText" },
      { name: "Platform", type: "singleSelect", options: { choices: [{ name: "CallRail" }, { name: "Google Ads" }, { name: "Meta Ads" }] } },
      { name: "External Type", type: "singleLineText" },
      { name: "External ID", type: "singleLineText" },
      { name: "External Name", type: "singleLineText" },
      { name: "Property", type: "multipleRecordLinks", options: { linkedTableId: "tblKEyDSoJF8tw6UY" } },
      { name: "Operator / Client", type: "multipleRecordLinks", options: { linkedTableId: "tbltGEwWrA9AbK9Xk" } },
      { name: "Property Source Key", type: "singleLineText" },
      { name: "Operator Source Key", type: "singleLineText" },
      { name: "Active", type: "checkbox", options: { icon: "check", color: "greenBright" } },
      { name: "Notes", type: "multilineText" },
    ],
  },
];

const schemaResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers });
if (!schemaResponse.ok) throw new Error(`Unable to read Airtable schema: ${schemaResponse.status}`);
const schema = await schemaResponse.json();
const existing = new Set((schema.tables || []).map((table) => table.name));

for (const definition of tableDefinitions) {
  if (existing.has(definition.name)) {
    console.log(`Exists: ${definition.name}`);
    continue;
  }
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers,
    body: JSON.stringify(definition),
  });
  if (!response.ok) throw new Error(`Unable to create ${definition.name}: ${response.status} ${await response.text()}`);
  console.log(`Created: ${definition.name}`);
}
