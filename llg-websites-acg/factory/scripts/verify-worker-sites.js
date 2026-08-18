const fs = require('fs');
const path = require('path');
const { writeManifest } = require('./worker-site-manifest');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT, 'out', 'worker-site-verification.json');
const INTAKE_ENDPOINT = 'https://launch-lead-gen-integrations-staging.justin-b75.workers.dev/v1/website-leads';
const FORBIDDEN_SOURCE = /\bNeal(?:\s+Roofing)?\b|nealrfg|west(?:[\s_-]+)palm(?:[\s_-]+)beach|palm(?:[\s_-]+)beach|boca(?:[\s_-]+)raton|delray(?:[\s_-]+)beach|\bJupiter(?:,\s*FL)?\b|\bWellington(?:,\s*FL)?\b|Centrepark|\b33409\b|CCC1332869|info@nealrfg\.com/i;

function htmlValue(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function verifyIntakeOrigin(site) {
  const origin = new URL(site.reviewUrl).origin;
  const response = await fetch(INTAKE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({
      submissionId: `origin-check-${site.sourceId.toLowerCase()}`,
      siteKey: site.sourceId.toLowerCase(),
      turnstileToken: '',
    }),
  });
  const body = await response.json().catch(() => ({}));
  const allowedOrigin = response.headers.get('access-control-allow-origin') || '';
  return {
    status: response.status,
    error: body.error || '',
    allowedOrigin,
    ok: response.status === 400
      && body.error === 'turnstile_failed'
      && allowedOrigin === origin,
  };
}

async function verify(site) {
  try {
    const initial = await fetch(site.reviewUrl, { redirect: 'manual' });
    const location = initial.headers.get('location') || '';
    const redirectOk = initial.status === 302
      && location.includes(`site=${encodeURIComponent(site.sourceId)}`)
      && location.includes(`type=${encodeURIComponent(site.profileId)}`)
      && location.includes(`theme=${encodeURIComponent(site.themeId)}`);
    if (!redirectOk) {
      return { ...site, ok: false, stage: 'redirect', status: initial.status, location };
    }

    const rendered = await fetch(location, { redirect: 'manual' });
    const html = await rendered.text();
    const assetExpectations = [
      ['/output.css', 'text/css'],
      ['/before-after.css', 'text/css'],
      ['/script.js', 'application/javascript'],
      ['/__palettes__/palette.css', 'text/css'],
      ['/__palettes__/site-profile.js', 'application/javascript'],
      ['/__palettes__/tracking.js', 'application/javascript'],
    ];
    const assetResults = await Promise.all(assetExpectations.map(async ([assetPath, expectedType]) => {
      const assetUrl = new URL(assetPath, site.reviewUrl);
      const response = await fetch(assetUrl, { redirect: 'manual' });
      const contentType = response.headers.get('content-type') || '';
      return {
        path: assetPath,
        status: response.status,
        contentType,
        ok: response.status === 200 && contentType.includes(expectedType),
      };
    }));
    const intakeOrigin = await verifyIntakeOrigin(site);
    const checks = {
      status: rendered.status === 200,
      siteHeader: rendered.headers.get('x-llg-review-site') === site.sourceId,
      robotsHeader: rendered.headers.get('x-robots-tag') === 'noindex, nofollow',
      sourceSanitized: rendered.headers.get('x-llg-source-sanitized') === 'true',
      sourceIndexState: rendered.headers.get('x-llg-index-state') === 'preview',
      forbiddenSourceAbsent: !FORBIDDEN_SOURCE.test(html),
      sourceBusinessName: html.includes(htmlValue(site.businessName)),
      sourceDomain: html.includes(site.domain),
      sourceMarket: html.includes(site.primaryMarket),
      sourcePhone: html.includes(site.phone.display),
      sourceMetadata: html.includes('name="site-factory-source" content="server-rendered"')
        && html.includes('name="site-factory-index-state" content="preview-noindex"'),
      noReviewCanonical: !/<link\b[^>]*\brel=["']canonical["']/i.test(html),
      profileMeta: html.includes(`name="site-profile-id" content="${site.profileId}"`),
      reviewSafety: html.includes('review-safety.js'),
      trackingRuntime: html.includes('/__palettes__/tracking.js'),
      assets: assetResults.every((asset) => asset.ok),
      intakeOrigin: intakeOrigin.ok,
    };
    return {
      ...site,
      ok: Object.values(checks).every(Boolean),
      stage: 'rendered',
      status: rendered.status,
      location,
      checks,
      assetResults,
      intakeOrigin,
    };
  } catch (error) {
    return { ...site, ok: false, stage: 'request', error: error.message };
  }
}

async function runPool(items, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await verify(items[index]);
      console.log(`[${index + 1}/${items.length}] ${results[index].ok ? 'OK' : 'FAILED'} ${items[index].domain}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const manifest = writeManifest();
  const results = await runPool(manifest.sites, 10);
  const failures = results.filter((result) => !result.ok);
  const report = {
    verifiedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.length - failures.length,
      failed: failures.length,
    },
    results,
  };
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Verification complete: ${report.summary.passed} passed, ${report.summary.failed} failed.`);
  console.log(OUTPUT_FILE);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
