import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsByName.set(process.argv[index], process.argv[index + 1]);
}

const rosterCandidates = [
  argumentsByName.get("--roster"),
  process.env.LLG_FACTORY_ROSTER,
  "../nealblueprint-mixedwithmach/review/homepage-palettes/airtable-websites.json",
  "C:/Dev/nealblueprint-mixedwithmach/review/homepage-palettes/airtable-websites.json",
  "../factory/data/airtable-websites.json",
].filter(Boolean).map((candidate) => resolve(candidate));
const rosterPath = rosterCandidates.find((candidate) => existsSync(candidate));
if (!rosterPath) {
  throw new Error(`Factory roster not found. Checked: ${rosterCandidates.join(", ")}`);
}
const outputPath = resolve(argumentsByName.get("--output") || "config/factory-sites.json");
const workersSubdomain = argumentsByName.get("--workers-subdomain") || "justin-b75";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const turnstilePath = resolve(
  argumentsByName.get("--turnstile-config")
    || process.env.LLG_TURNSTILE_CONFIG
    || resolve(scriptDirectory, "../../../factory/config/turnstile-widgets.json"),
);

function normalizedDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:www\.)?/, "")
    .replace(/\/.*$/, "");
}

function workerName(domain) {
  const domainStem = domain
    .replace(/^www\./, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const preferred = `llg-site-${domainStem}`;
  if (preferred.length <= 63) return preferred;
  const suffix = createHash("sha256").update(domain).digest("hex").slice(0, 8);
  return `${preferred.slice(0, 54).replace(/-+$/, "")}-${suffix}`;
}

const roster = JSON.parse(await readFile(rosterPath, "utf8"));
const turnstileConfig = JSON.parse(await readFile(turnstilePath, "utf8"));
const turnstileByDomain = new Map();
for (const widget of turnstileConfig.widgets || []) {
  if (!widget.id || !widget.siteKey || !widget.secretBinding) throw new Error("Invalid Turnstile widget configuration");
  if (!Array.isArray(widget.domains) || widget.domains.length < 1 || widget.domains.length > 10) {
    throw new Error(`Turnstile widget ${widget.id} must contain between 1 and 10 domains`);
  }
  for (const rawDomain of widget.domains) {
    const domain = normalizedDomain(rawDomain);
    if (turnstileByDomain.has(domain)) throw new Error(`Duplicate Turnstile domain: ${domain}`);
    turnstileByDomain.set(domain, widget);
  }
}
const sites = roster.sites.map((site) => {
  const domain = normalizedDomain(site.domain);
  if (!site.sourceId || !domain) throw new Error(`Invalid factory site row: ${JSON.stringify(site)}`);
  const worker = workerName(domain);
  const turnstileWidget = turnstileByDomain.get(domain) || null;
  return {
    siteKey: String(site.sourceId).toLowerCase(),
    sourceId: site.sourceId,
    domain,
    propertyKey: `domain:${domain}`,
    workerName: worker,
    reviewHosts: [`${worker}.${workersSubdomain}.workers.dev`],
    businessName: site.businessName,
    profileId: site.profileId || null,
    themeId: site.themeId || "deep-blue-white",
    turnstileGroup: turnstileWidget?.id || null,
    deployable: Boolean(site.includeInRollout && site.profileId),
  };
}).sort((left, right) => left.siteKey.localeCompare(right.siteKey));

const keys = new Set();
const domains = new Set();
for (const site of sites) {
  if (keys.has(site.siteKey)) throw new Error(`Duplicate site key: ${site.siteKey}`);
  if (domains.has(site.domain)) throw new Error(`Duplicate domain: ${site.domain}`);
  keys.add(site.siteKey);
  domains.add(site.domain);
}

const payload = {
  schemaVersion: 2,
  generatedFrom: rosterPath.replaceAll("\\", "/").replace(/^.*(?=review\/homepage-palettes\/airtable-websites\.json$)/, ""),
  generatedAt: new Date().toISOString(),
  workersSubdomain,
  summary: {
    sites: sites.length,
    deployable: sites.filter((site) => site.deployable).length,
    pendingProfiles: sites.filter((site) => !site.deployable).length,
  },
  sites,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${sites.length} factory sites (${payload.summary.deployable} deployable) to ${outputPath}`);
