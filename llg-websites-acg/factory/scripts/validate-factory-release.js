const fs = require('fs');
const path = require('path');
const { buildManifest } = require('./worker-site-manifest');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_ROOT = path.join(ROOT, 'review', 'homepage-palettes');
const RUNTIME_ROOT = path.join(ROOT, 'out', 'cloudflare-review');
const INTEGRATION_CONFIG = path.join(ROOT, 'config', 'factory-sites.json');
const ALLOWED_THEMES = new Set([
  'charcoal-blue-accent',
  'soft-luxury-blue',
  'almost-monochrome-blue',
  'deep-blue-white',
  'cream-red-light-blue',
  'black-warm-gray-white',
  'high-end-blue-neutral',
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validate() {
  const roster = readJson(path.join(REVIEW_ROOT, 'airtable-websites.json'));
  const phones = readJson(path.join(REVIEW_ROOT, 'phone-directory.json'));
  const palettes = readJson(path.join(REVIEW_ROOT, 'palettes.json'));
  const turnstile = readJson(path.join(ROOT, 'config', 'turnstile-widgets.json'));
  const productionLaunch = readJson(path.join(ROOT, 'config', 'production-launch.json'));
  const manifest = buildManifest();
  const integration = readJson(INTEGRATION_CONFIG);
  const paletteIds = new Set(palettes.map((palette) => palette.id));
  const turnstileByDomain = new Map();
  const launchedDomains = new Set(productionLaunch.domains || []);
  assert(turnstile.reviewWidget?.siteKey, 'Review Turnstile widget is missing.');
  assert(turnstile.reviewWidget.domains.includes('justin-b75.workers.dev'), 'Review Turnstile widget lacks the Workers root hostname.');
  assert(turnstile.reviewWidget.domains.includes('aryo-cg-preview.pages.dev'), 'Review Turnstile widget lacks the Pages root hostname.');
  for (const widget of turnstile.widgets || []) {
    assert(widget.id && widget.siteKey && widget.secretBinding, 'Turnstile widget configuration is incomplete.');
    assert(widget.domains.length >= 1 && widget.domains.length <= 10, `Turnstile widget ${widget.id} exceeds the hostname limit.`);
    for (const domain of widget.domains) {
      assert(!turnstileByDomain.has(domain), `Duplicate Turnstile domain: ${domain}`);
      turnstileByDomain.set(domain, widget);
    }
  }

  assert(roster.sites.length === integration.summary.sites, 'Roster and intake registry counts differ.');
  assert(manifest.sites.length === integration.summary.deployable, 'Deployable site counts differ.');
  assert(manifest.pending.length === integration.summary.pendingProfiles, 'Pending profile counts differ.');
  assert(integration.sites.length === roster.sites.length, 'Intake registry does not contain every roster site.');

  const sourceIds = new Set();
  const domains = new Set();
  for (const site of roster.sites) {
    assert(site.sourceId && !sourceIds.has(site.sourceId), `Missing or duplicate source ID: ${site.sourceId}`);
    assert(site.domain && !domains.has(site.domain), `Missing or duplicate domain: ${site.domain}`);
    assert(ALLOWED_THEMES.has(site.themeId), `Unapproved rollout theme on ${site.domain}: ${site.themeId}`);
    assert(paletteIds.has(site.themeId), `Missing palette definition: ${site.themeId}`);
    sourceIds.add(site.sourceId);
    domains.add(site.domain);
  }

  const drainscape = roster.sites.find((site) => site.sourceId === 'LLG-DRAINSCAPE');
  assert(drainscape?.themeId === 'deep-blue-white', 'DrainScape must use Deep Blue / White.');

  for (const site of manifest.sites) {
    const phone = site.phone;
    assert(phone?.e164 && phone?.display, `Deployable site is missing its phone: ${site.domain}`);
    assert(site.sourceConfig?.businessName === site.businessName, `Source identity mismatch for ${site.domain}`);
    assert(site.sourceConfig?.domain === site.domain, `Source domain mismatch for ${site.domain}`);
    assert(site.sourceConfig?.contactEmail === 'justin@aryocg.com', `Contact email mismatch for ${site.domain}`);
    assert(site.sourceConfig?.services?.length >= 1, `Source services are missing for ${site.domain}`);
    assert(site.sourceConfig?.types?.length >= 1, `Source types are missing for ${site.domain}`);
    const registered = integration.sites.find((item) => item.siteKey === site.sourceId.toLowerCase());
    assert(registered?.domain === site.domain, `Intake mapping mismatch for ${site.domain}`);
    assert(registered?.workerName === site.workerName, `Worker origin mismatch for ${site.domain}`);
    const widget = turnstileByDomain.get(site.domain);
    assert((registered?.turnstileGroup || null) === (widget?.id || null), `Turnstile intake group mismatch for ${site.domain}`);
    assert(site.turnstileSiteKey === (widget?.siteKey || ''), `Turnstile site key mismatch for ${site.domain}`);
    assert(site.launchEnabled === launchedDomains.has(site.domain), `Production launch state mismatch for ${site.domain}`);
    if (site.launchEnabled) assert(site.turnstileSiteKey, `Live site lacks a real Turnstile assignment: ${site.domain}`);
  }
  for (const domain of launchedDomains) {
    assert(manifest.sites.some((site) => site.domain === domain), `Production launch domain is not deployable: ${domain}`);
  }

  const requiredRuntimeFiles = [
    '_headers',
    '_redirects',
    '__palettes__/tracking.js',
    '__palettes__/site-profile.js',
    '__palettes__/phone-directory.json',
  ];
  for (const relativePath of requiredRuntimeFiles) {
    assert(fs.existsSync(path.join(RUNTIME_ROOT, relativePath)), `Runtime is missing ${relativePath}`);
  }
  const headers = fs.readFileSync(path.join(RUNTIME_ROOT, '_headers'), 'utf8');
  assert(headers.includes('X-Robots-Tag: noindex, nofollow'), 'Review runtime must remain noindex.');
  const tracking = fs.readFileSync(path.join(RUNTIME_ROOT, '__palettes__', 'tracking.js'), 'utf8');
  assert(tracking.includes('/v1/website-leads'), 'Tracking runtime is missing the centralized intake endpoint.');
  assert(tracking.includes(turnstile.reviewWidget.siteKey), 'Tracking runtime is missing the real review Turnstile key.');
  assert(!tracking.includes('1x00000000000000000000AA'), 'Tracking runtime still exposes the Turnstile test widget.');

  const renderedHtml = [];
  const renderedRoot = path.join(RUNTIME_ROOT, '__rendered__');
  for (const profile of fs.readdirSync(renderedRoot)) {
    const file = path.join(renderedRoot, profile, 'internal', 'index.html');
    if (fs.existsSync(file)) renderedHtml.push(fs.readFileSync(file, 'utf8'));
  }
  assert(renderedHtml.length === 12, `Expected 12 rendered profiles, found ${renderedHtml.length}.`);
  assert(renderedHtml.every((html) => html.includes('/__palettes__/tracking.js')), 'A rendered profile is missing the tracking runtime.');

  const themeCounts = Object.fromEntries([...ALLOWED_THEMES].map((theme) => [
    theme,
    roster.sites.filter((site) => site.themeId === theme).length,
  ]));
  console.log(JSON.stringify({
    rosterSites: roster.sites.length,
    deployableSites: manifest.sites.length,
    pendingProfiles: manifest.pending.length,
    turnstileReadySites: manifest.summary.turnstileReadySites,
    launchEnabledSites: manifest.summary.launchEnabledSites,
    renderedProfiles: renderedHtml.length,
    themeCounts,
    status: 'valid',
  }, null, 2));
}

validate();
