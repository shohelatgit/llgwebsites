const fs = require('fs');
const path = require('path');
const { buildManifest } = require('./worker-site-manifest');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_ROOT = path.join(ROOT, 'out', 'cloudflare-review');
const OUTPUT_FILE = path.join(ROOT, 'out', 'source-sanitization-verification.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlValue(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|quot|#039|nbsp);/g, ' ')
    .replace(/\s+/g, ' ');
}

function schemaDocuments(html) {
  return [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

async function main() {
  const { sanitizeHtml, findForbiddenSourceTerms, sourceSanitizerInternals } = await import('../workers/site-source.mjs');
  const manifest = buildManifest();
  const routes = ['/', '/services', '/types', '/locations', '/gallery', '/blog'];
  const results = [];

  for (const site of manifest.sites) {
    const homeFile = path.join(RUNTIME_ROOT, '__site__', site.profileId, 'index.html');
    const internalFile = path.join(RUNTIME_ROOT, '__rendered__', site.profileId, 'internal', 'index.html');
    assert(fs.existsSync(homeFile), `Missing home source template for ${site.profileId}`);
    assert(fs.existsSync(internalFile), `Missing internal source template for ${site.profileId}`);
    const home = fs.readFileSync(homeFile, 'utf8');
    const internal = fs.readFileSync(internalFile, 'utf8');

    for (const route of routes) {
      const source = route === '/' ? home : internal;
      const output = sanitizeHtml(source, site.sourceConfig, route, 'preview');
      const forbidden = findForbiddenSourceTerms(output.html);
      assert(forbidden.length === 0, `${site.domain}${route} retained: ${forbidden.join(', ')}`);
      assert(output.html.includes(htmlValue(site.businessName)), `${site.domain}${route} is missing its business name.`);
      assert(output.html.includes(site.domain), `${site.domain}${route} is missing its domain.`);
      assert(output.html.includes(site.phone.display), `${site.domain}${route} is missing its phone.`);
      assert(output.html.includes(site.primaryMarket), `${site.domain}${route} is missing its market.`);
      assert(/<meta\s+name="robots"\s+content="noindex,nofollow">/i.test(output.html), `${site.domain}${route} is not preview-noindex.`);
      assert(/<meta\s+name="site-factory-source"\s+content="server-rendered">/i.test(output.html), `${site.domain}${route} lacks the source marker.`);
      assert(output.html.includes(`data-site-source-id="${site.sourceId}"`), `${site.domain}${route} lacks its server-injected source ID.`);
      assert(output.html.includes(`data-site-profile="${site.profileId}"`), `${site.domain}${route} lacks its server-injected profile ID.`);
      assert(!/<link\b[^>]*\brel=["']canonical["']/i.test(output.html), `${site.domain}${route} exposed a review canonical.`);
      const schemas = schemaDocuments(output.html);
      assert(schemas.length === 1, `${site.domain}${route} should have one source schema graph.`);
      assert(schemas[0]['@context'] === 'https://schema.org', `${site.domain}${route} has invalid schema context.`);

      if (site.profileId !== 'roofing') {
        const text = visibleText(output.html);
        assert(!/\b(?:Neal|roofers?|roofing|shingles?)\b/i.test(text), `${site.domain}${route} retained visible roofing source copy.`);
      }
      if (route === '/') {
        const expectedH1 = sourceSanitizerInternals.generatedHeroH1(site.sourceConfig);
        assert(output.html.includes(htmlValue(expectedH1)), `${site.domain} has the wrong server-rendered H1.`);
      }
      results.push({ sourceId: site.sourceId, domain: site.domain, route, status: 'passed' });
    }
  }

  const productionSite = manifest.sites[0];
  const productionHome = fs.readFileSync(
    path.join(RUNTIME_ROOT, '__site__', productionSite.profileId, 'index.html'),
    'utf8',
  );
  const productionOutput = sanitizeHtml(productionHome, productionSite.sourceConfig, '/', 'production');
  assert(/<meta\s+name="robots"\s+content="index,follow">/i.test(productionOutput.html), 'Production source is not indexable.');
  assert(/<link\b[^>]*\brel="canonical"[^>]*>/i.test(productionOutput.html), 'Production source lacks a canonical.');
  assert(findForbiddenSourceTerms(productionOutput.html).length === 0, 'Production source retained forbidden identity copy.');

  const report = {
    verifiedAt: new Date().toISOString(),
    summary: {
      sites: manifest.sites.length,
      routesPerSite: routes.length,
      pages: results.length,
      passed: results.length,
      failed: 0,
    },
    forbiddenPatterns: 'No source brand, market, address, license, email, or non-roofing source terminology remains.',
    results,
  };
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Source sanitization passed for ${report.summary.pages} pages across ${report.summary.sites} sites.`);
  console.log(OUTPUT_FILE);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
