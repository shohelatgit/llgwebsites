import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildManifest } = require('./worker-site-manifest');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_ROOT = path.join(ROOT, 'out', 'cloudflare-review');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const module = await import('../workers/site-review-proxy.mjs');
  const site = buildManifest().sites.find((item) => item.turnstileSiteKey);
  assert(site, 'No Turnstile-ready production site exists.');

  const home = fs.readFileSync(path.join(RUNTIME_ROOT, '__site__', site.profileId, 'index.html'), 'utf8');
  const internal = fs.readFileSync(path.join(RUNTIME_ROOT, '__rendered__', site.profileId, 'internal', 'index.html'), 'utf8');
  const upstreamRequests = [];
  const originalFetch = global.fetch;
  global.fetch = async (request) => {
    const url = new URL(typeof request === 'string' ? request : request instanceof URL ? request.href : request.url);
    upstreamRequests.push(url);
    const body = url.pathname.endsWith('/') ? home : internal;
    return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  };

  const env = {
    SITE_ID: site.sourceId,
    PROFILE_ID: site.profileId,
    THEME_ID: site.themeId,
    SITE_CONFIG: JSON.stringify(site.sourceConfig),
    INDEX_STATE: 'production',
  };

  try {
    const live = await module.default.fetch(new Request(`https://${site.domain}/services?utm_source=qa`), env);
    assert(live.status === 200, 'Live custom-domain request did not render.');
    assert(!live.headers.has('location'), 'Live custom-domain request exposed a factory redirect.');
    assert(live.headers.get('x-llg-launch-state') === 'live-noindex', 'Unapproved site must launch noindex.');
    assert(live.headers.get('x-robots-tag') === 'noindex, nofollow', 'Unapproved site is indexable.');
    const liveHtml = await live.text();
    assert(liveHtml.includes(`data-site-source-id="${site.sourceId}"`), 'Live HTML lacks site identity.');
    assert(liveHtml.includes(`data-turnstile-site-key="${site.turnstileSiteKey}"`), 'Live HTML lacks its real Turnstile key.');
    assert(upstreamRequests.at(-1).pathname === `/__site__/${site.profileId}/services`, 'Live route did not map internally.');
    assert(upstreamRequests.at(-1).searchParams.get('site') === site.sourceId, 'Live upstream request lacks the site identity.');

    const preview = await module.default.fetch(new Request(site.reviewUrl), env);
    assert(preview.status === 302, 'Workers.dev review URL must retain its factory redirect.');
    assert(preview.headers.get('location')?.includes(`site=${encodeURIComponent(site.sourceId)}`), 'Review redirect lacks the site identity.');

    const robots = await module.default.fetch(new Request(`https://${site.domain}/robots.txt`), env);
    assert((await robots.text()).includes('Disallow: /'), 'Soft launch robots.txt must disallow crawling.');

    const approvedConfig = { ...site.sourceConfig, productionApproved: true };
    const approvedEnv = { ...env, SITE_CONFIG: JSON.stringify(approvedConfig) };
    const indexed = await module.default.fetch(new Request(`https://${site.domain}/`), approvedEnv);
    assert(indexed.headers.get('x-llg-launch-state') === 'production-index', 'Approved site did not enter the production index state.');
    assert((await indexed.text()).includes(`<link rel="canonical" href="https://${site.domain}/">`), 'Approved site lacks its canonical URL.');

    const sitemap = await module.default.fetch(new Request(`https://${site.domain}/sitemap.xml`), approvedEnv);
    assert(sitemap.status === 200 && (await sitemap.text()).includes(`https://${site.domain}/services`), 'Approved site sitemap is invalid.');

    const www = await module.default.fetch(new Request(`https://www.${site.domain}/services`), approvedEnv);
    assert(www.status === 301 && www.headers.get('location') === `https://${site.domain}/services`, 'www does not redirect to the canonical apex.');
  } finally {
    global.fetch = originalFetch;
  }

  console.log(`Production Worker contract passed for ${site.domain}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
