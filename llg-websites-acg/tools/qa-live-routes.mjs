import { readFile, writeFile } from 'node:fs/promises';

const portfolio = JSON.parse(await readFile('data/sites.json', 'utf8'));
const checks = [];
for (const site of portfolio.sites) {
  const project = site.directory.toLowerCase();
  const base = `https://clone-rebuild.${project}.pages.dev`;
  for (const page of site.pages) {
    const path = page.slug ? `/${page.slug}/` : '/';
    checks.push({ site: site.siteKey, kind: 'page', url: `${base}${path}` });
  }
  checks.push({ site: site.siteKey, kind: 'robots', url: `${base}/robots.txt` });
  checks.push({ site: site.siteKey, kind: 'sitemap', url: `${base}/sitemap.xml` });
}

const results = [];
for (let offset = 0; offset < checks.length; offset += 20) {
  const batch = checks.slice(offset, offset + 20);
  results.push(...await Promise.all(batch.map(async (check) => {
    try {
      const response = await fetch(check.url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      const body = await response.text();
      const xRobots = response.headers.get('x-robots-tag') ?? '';
      const issues = [];
      if (response.status !== 200) issues.push(`HTTP ${response.status}`);
      if (check.kind === 'page') {
        if (!/noindex/i.test(xRobots)) issues.push('missing X-Robots noindex');
        const hasMetaNoindex = (body.match(/<meta[^>]*>/gi) ?? []).some((tag) => /name=["']robots["']/i.test(tag) && /noindex/i.test(tag));
        if (!hasMetaNoindex) issues.push('missing meta noindex');
        if (/<link[^>]+rel=["']canonical["']/i.test(body)) issues.push('staging canonical present');
      } else if (check.kind === 'robots' && !/Disallow:\s*\//i.test(body)) {
        issues.push('robots does not disallow');
      } else if (check.kind === 'sitemap' && /<url>/i.test(body)) {
        issues.push('staging sitemap contains URLs');
      }
      return { ...check, status: response.status, xRobots, issues };
    } catch (error) {
      return { ...check, status: null, xRobots: '', issues: [error instanceof Error ? error.message : String(error)] };
    }
  })));
}

const failures = results.filter((result) => result.issues.length);
const report = { runDate: new Date().toISOString(), siteCount: portfolio.sites.length, checks: results.length, failureCount: failures.length, failures, results };
await writeFile('.qa/live-routes.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ siteCount: report.siteCount, checks: report.checks, failureCount: report.failureCount, failures: failures.slice(0, 20) }, null, 2));
if (failures.length) process.exitCode = 1;
