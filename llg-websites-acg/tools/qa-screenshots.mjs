import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const firstWave = ['connecticut-drain-pros', 'dallas-drain-guys', 'louisville-precision-walls', 'morgantown-fence-pros', 'Pittsburgh-French-Drain-Site'];
const remaining = JSON.parse(await readFile(new URL('./remaining-sites.json', import.meta.url), 'utf8'));
const requestedSite = process.env.QA_SITE;
const sites = [...firstWave, ...remaining.map(site => site.target)].filter(site => !requestedSite || site.toLowerCase() === requestedSite.toLowerCase());
const viewports = [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }], ['mobile-320', { width: 320, height: 780 }]];
const live = process.env.QA_LIVE === '1';
await mkdir('.qa', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

async function startSiteServer(site) {
  const root = resolve(site);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let filePath = normalize(join(root, relative));
      if (!filePath.startsWith(root)) throw new Error('Path traversal');
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) filePath = join(filePath, 'index.html');
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  return { server, base: `http://127.0.0.1:${address.port}` };
}

for (const site of sites) {
  const local = live ? null : await startSiteServer(site);
  for (const [viewportName, viewport] of viewports) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const requestFailures = [];
    const sameOriginResourceErrors = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => requestFailures.push(request.url()));
    const project = site.toLowerCase();
    const pageUrl = live ? `https://clone-rebuild.${project}.pages.dev/` : `${local.base}/`;
    const pageOrigin = new URL(pageUrl).origin;
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === pageOrigin) {
        sameOriginResourceErrors.push({ status: response.status(), url: response.url() });
      }
    });
    let response;
    let navigationError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        navigationError = undefined;
        break;
      } catch (error) {
        navigationError = error;
        if (attempt === 1) await page.waitForTimeout(2000);
      }
    }
    if (navigationError) throw navigationError;
    await page.waitForTimeout(1500);
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
    await page.screenshot({ path: `.qa/${site}-${viewportName}.png`, fullPage: false });
    const measured = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      title: document.title,
      brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).length,
      brokenSources: [...document.images].filter(image => image.complete && image.naturalWidth === 0).slice(0, 8).map(image => image.currentSrc || image.src),
      noindex: document.querySelector('meta[name="robots"]')?.content ?? '',
      forms: [...document.forms].map(form => ({ action: form.getAttribute('action'), staging: form.dataset.stagingForm ?? null })),
    }));
    const result = {
      site,
      viewport: viewportName,
      dimensions: `${viewport.width}x${viewport.height}`,
      status: response?.status() ?? null,
      documentWidth: measured.width,
      horizontalOverflow: Math.max(0, measured.width - measured.viewport),
      brokenImages: measured.brokenImages,
      brokenSources: measured.brokenSources,
      noindex: /\bnoindex\b/i.test(measured.noindex),
      consoleErrors,
      requestFailures,
      sameOriginResourceErrors,
      forms: measured.forms,
      title: measured.title,
    };
    results.push(result);
    console.log(`${site} ${viewportName}: width=${measured.width}/${measured.viewport}; broken=${measured.brokenImages}; console=${consoleErrors.length}; requests=${requestFailures.length}; noindex=${result.noindex}`);
    await page.close();
  }
  if (local) await new Promise(resolveClose => local.server.close(resolveClose));
}

await browser.close();
const summary = {
  runDate: new Date().toISOString(),
  base: live ? 'https://clone-rebuild.{project}.pages.dev/' : 'isolated local site roots',
  browser: 'Installed Google Chrome via Playwright',
  siteCount: sites.length,
  viewportCount: viewports.length,
  checks: results.length,
  failures: results.filter(result => result.status !== 200 || result.horizontalOverflow !== 0 || result.brokenImages !== 0 || result.sameOriginResourceErrors.length !== 0 || !result.noindex),
  results,
};
await writeFile('.qa/smoke-results.json', `${JSON.stringify(summary, null, 2)}\n`);
if (summary.failures.length) {
  console.error(`Hard smoke failures: ${summary.failures.length}`);
  process.exitCode = 1;
}
