import { chromium } from 'playwright';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const localRoot = resolve('..', '.codex-work');
let server = null;
let base = process.env.CLONE_REFERENCE_BASE;
if (!base) {
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  server = createServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '');
      let target = resolve(localRoot, relative);
      if (!target.startsWith(localRoot)) throw new Error('invalid path');
      if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
      response.setHeader('Content-Type', contentTypes[extname(target).toLowerCase()] ?? 'application/octet-stream');
      createReadStream(target).pipe(response);
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  });
  await new Promise((resolveListen) => server.listen(4174, '127.0.0.1', resolveListen));
  base = 'http://127.0.0.1:4174';
}
const outputRoot = resolve('references/clone-reference-pack');
const sources = [
  ['horizonfix', 'HorizonFix', 'llg-clone-sources/horizonfix-clone/horizonfix-clone/site/'],
  ['minuteman', 'Minuteman', 'llg-clone-sources-tar/minuteman-clone/minuteman-clone/site/'],
  ['pinks-concrete', "Pink's Concrete", 'llg-clone-sources/pinks-concrete-clone/pinks-concrete-clone/'],
  ['roofrightnow', 'Roof Right Now', 'llg-clone-sources/roofrightnow-clone/roofrightnow-clone/site/'],
  ['welborn-garage', 'Welborn Garage', 'llg-clone-sources-tar/welborn-garage-clone/welborn-garage-clone/site/'],
  ['cincinnati-painting', 'Cincinnati Painting', 'llg-clone-sources/cincinnati-painting-clone/cincinnati-painting-clone/site/'],
  ['nextgen-windows', 'NextGen Windows', 'llg-clone-sources/nextgen-windows-clone/nextgen-windows-clone/'],
  ['trips-windows-small', 'Trips Windows small', 'llg-clone-sources/trips-windows-clone/trips-windows-clone/'],
  ['trips-windows-full', 'Trips Windows full', 'llg-clone-sources/tripswindows-clone/tripswindows-clone/site/'],
];
const viewports = [
  { id: 'desktop', width: 1440, height: 1100, deviceScaleFactor: 1 },
  { id: 'tablet', width: 1024, height: 900, deviceScaleFactor: 1 },
  { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 },
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const pages = [];
for (const [id, label, relativeUrl] of sources) {
  const url = `${base}/${relativeUrl}`;
  const captures = [];
  const observations = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((resolveScroll) => setTimeout(resolveScroll, 250));
      window.scrollTo(0, 0);
      if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((resolveFonts) => setTimeout(resolveFonts, 1500))]);
    });
    const directory = resolve(outputRoot, 'screenshots', id, viewport.id);
    await mkdir(directory, { recursive: true });
    const target = resolve(directory, 'default.png');
    await page.screenshot({ path: target, fullPage: true });
    const measured = await page.evaluate(() => ({
      bodyChildren: [...document.body.children].map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].slice(0, 4).join('.')}`),
      sections: document.querySelectorAll('section').length,
      headings: [...document.querySelectorAll('h1,h2,h3')].length,
      forms: document.forms.length,
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    }));
    observations.push({ viewport: viewport.id, status: response?.status() ?? null, ...measured });
    captures.push({ viewport: viewport.id, state: 'default', path: `screenshots/${id}/${viewport.id}/default.png`, fullPage: true, dynamicRegions: [] });
    await page.close();
  }
  const notesPath = `notes/${id}.md`;
  await mkdir(resolve(outputRoot, 'notes'), { recursive: true });
  await writeFile(resolve(outputRoot, notesPath), `# ${label}\n\n- Source: supplied offline clone package.\n- Rights: design-reference-only; source logo, copy, claims, reviews, and photography must be replaced.\n- Authority: homepage DOM, section order, component geometry, responsive composition, CTA anatomy, and interaction placement.\n- Captures: desktop, tablet, and mobile default states.\n- Observations: \`${JSON.stringify(observations)}\`\n`);
  pages.push({ id, url, archetype: 'home', notesPath, captures });
}
await browser.close();
if (server) await new Promise((resolveClose) => server.close(resolveClose));

const manifest = {
  version: 1,
  source: { name: 'Nine supplied offline clone packages', baseUrl: base, capturedAt: new Date().toISOString(), rights: 'design-reference-only' },
  viewports,
  pages,
};
await writeFile(resolve(outputRoot, 'capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputRoot, pages: pages.length, captures: pages.reduce((count, page) => count + page.captures.length, 0) }));
