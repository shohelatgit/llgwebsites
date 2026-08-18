const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROSTER_FILE = path.join(ROOT, 'review', 'homepage-palettes', 'airtable-websites.json');
const PHONE_FILE = path.join(ROOT, 'review', 'homepage-palettes', 'phone-directory.json');
const PROFILE_FILE = path.join(ROOT, 'review', 'homepage-palettes', 'website-profiles.json');
const TURNSTILE_FILE = path.join(ROOT, 'config', 'turnstile-widgets.json');
const PRODUCTION_LAUNCH_FILE = path.join(ROOT, 'config', 'production-launch.json');
const OUTPUT_FILE = path.join(ROOT, 'out', 'worker-site-manifest.json');
const WORKERS_SUBDOMAIN = process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || 'justin-b75';

function workerName(domain) {
  const domainStem = domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const preferred = `llg-site-${domainStem}`;
  if (preferred.length <= 63) return preferred;
  const suffix = crypto.createHash('sha256').update(domain).digest('hex').slice(0, 8);
  return `${preferred.slice(0, 54).replace(/-+$/, '')}-${suffix}`;
}

function buildManifest() {
  const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
  const phoneDirectory = JSON.parse(fs.readFileSync(PHONE_FILE, 'utf8'));
  const profiles = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
  const turnstile = JSON.parse(fs.readFileSync(TURNSTILE_FILE, 'utf8'));
  const productionLaunch = JSON.parse(fs.readFileSync(PRODUCTION_LAUNCH_FILE, 'utf8'));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const turnstileByDomain = new Map();
  const launchedDomains = new Set(productionLaunch.domains || []);
  if (!turnstile.reviewWidget?.siteKey
    || !Array.isArray(turnstile.reviewWidget.domains)
    || turnstile.reviewWidget.domains.length < 1
    || turnstile.reviewWidget.domains.length > 10) {
    throw new Error('Review Turnstile widget configuration is incomplete.');
  }
  for (const widget of turnstile.widgets || []) {
    if (!widget.id || !widget.siteKey || !widget.secretBinding) {
      throw new Error('Turnstile widget configuration is incomplete.');
    }
    if (!Array.isArray(widget.domains) || widget.domains.length < 1 || widget.domains.length > 10) {
      throw new Error(`Turnstile widget ${widget.id} must contain between 1 and 10 domains.`);
    }
    for (const domain of widget.domains) {
      if (turnstileByDomain.has(domain)) throw new Error(`Duplicate Turnstile domain: ${domain}`);
      turnstileByDomain.set(domain, widget);
    }
  }
  const eligible = roster.sites.filter((site) => site.includeInRollout && site.profileId);
  const pending = roster.sites.filter((site) => site.includeInRollout && !site.profileId);
  const sites = eligible.map((site) => {
    const name = workerName(site.domain);
    const profile = profileById.get(site.profileId);
    const phone = phoneDirectory.sites?.[site.sourceId]?.phone;
    const turnstileWidget = turnstileByDomain.get(site.domain) || null;
    if (!profile) throw new Error(`Missing profile ${site.profileId} for ${site.domain}`);
    if (!phone?.e164 || !phone?.display) throw new Error(`Missing phone for ${site.domain}`);
    const rosterIndex = roster.sites.findIndex((item) => item.sourceId === site.sourceId);
    const sourceConfig = {
      sourceId: site.sourceId,
      domain: site.domain,
      businessName: site.businessName,
      profileId: site.profileId,
      themeId: site.themeId || 'deep-blue-white',
      primaryMarket: site.marketDisplayName || site.primaryMarket || '',
      state: site.state || '',
      stateName: site.stateName || '',
      phoneDisplay: phone.display,
      phoneE164: phone.e164,
      contactEmail: 'justin@aryocg.com',
      productionApproved: site.productionApproved === true,
      turnstileSiteKey: turnstileWidget?.siteKey || '',
      turnstileGroup: turnstileWidget?.id || '',
      launchEnabled: launchedDomains.has(site.domain),
      heroH1Variant: rosterIndex >= 0 ? (rosterIndex % 5) + 1 : 1,
      marketCopy: site.marketCopy || {},
      niche: profile.niche,
      tradeTerm: profile.tradeTerm,
      projectNoun: profile.projectNoun,
      projectNounPlural: profile.projectNounPlural,
      companyNoun: profile.companyNoun,
      serviceGroupLabel: profile.serviceGroupLabel,
      serviceSingular: profile.serviceSingular,
      typesLabel: profile.typesLabel,
      heroH1: profile.heroH1,
      intro: profile.intro,
      services: profile.services,
      types: profile.types,
    };
    return {
      sourceId: site.sourceId,
      domain: site.domain,
      businessName: site.businessName,
      profileId: site.profileId,
      themeId: site.themeId || 'deep-blue-white',
      primaryMarket: site.marketDisplayName || site.primaryMarket || '',
      state: site.state || '',
      phone: {
        display: phone.display,
        e164: phone.e164,
      },
      contactEmail: 'justin@aryocg.com',
      productionApproved: site.productionApproved === true,
      turnstileSiteKey: turnstileWidget?.siteKey || '',
      turnstileGroup: turnstileWidget?.id || '',
      launchEnabled: launchedDomains.has(site.domain),
      sourceConfig,
      workerName: name,
      reviewUrl: `https://${name}.${WORKERS_SUBDOMAIN}.workers.dev/`,
    };
  });

  const names = new Set();
  for (const site of sites) {
    if (names.has(site.workerName)) throw new Error(`Duplicate Worker name: ${site.workerName}`);
    names.add(site.workerName);
  }

  return {
    generatedAt: new Date().toISOString(),
    source: path.relative(ROOT, ROSTER_FILE).replaceAll('\\', '/'),
    reviewOrigin: 'https://llg-site-factory-review.aryo-cg-preview.pages.dev',
    indexState: 'preview-noindex',
    workersSubdomain: WORKERS_SUBDOMAIN,
    summary: {
      rosterSites: roster.sites.length,
      eligibleSites: sites.length,
      pendingProfileSites: pending.length,
      turnstileReadySites: sites.filter((site) => site.turnstileSiteKey).length,
      launchEnabledSites: sites.filter((site) => site.launchEnabled).length,
    },
    sites,
    pending: pending.map((site) => ({
      sourceId: site.sourceId,
      domain: site.domain,
      businessName: site.businessName,
      niche: site.niche,
      reason: 'No matched website profile',
    })),
  };
}

function writeManifest() {
  const manifest = buildManifest();
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) {
  const manifest = writeManifest();
  console.log(`Prepared ${manifest.summary.eligibleSites} deployable sites; ${manifest.summary.pendingProfileSites} remain profile-pending.`);
  console.log(OUTPUT_FILE);
}

module.exports = { buildManifest, writeManifest, workerName, OUTPUT_FILE };
