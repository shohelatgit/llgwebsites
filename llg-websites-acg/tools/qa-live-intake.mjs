import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const sourceBundleSites = ['dallas-drain-guys', 'chicago-drainage-guys', 'pgh-painting-pros', 'tulsa-drain-pros'];
const consoleChecks = [];

for (const site of sourceBundleSites) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const response = await page.goto(`https://clone-rebuild.${site}.pages.dev/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1800);
  consoleChecks.push({ site, status: response?.status() ?? null, errors });
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const formConsoleErrors = [];
let intakeResponse = null;
page.on('console', (message) => { if (message.type() === 'error') formConsoleErrors.push(message.text()); });
page.on('response', async (networkResponse) => {
  if (networkResponse.url().endsWith('/v1/website-leads')) {
    intakeResponse = { status: networkResponse.status(), body: await networkResponse.text().catch(() => '') };
  }
});
const url = 'https://clone-rebuild.austin-drain-guys.pages.dev/contact/?utm_source=codex-qa';
const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
try {
  await page.waitForFunction(() => {
    const token = document.querySelector('textarea[name="cf-turnstile-response"], input[name="cf-turnstile-response"]');
    return Boolean(token?.value);
  }, { timeout: 30000 });
} catch (error) {
  const diagnostics = await page.evaluate(() => ({
    scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
    frames: [...document.querySelectorAll('iframe')].map((frame) => frame.src),
    tokenFields: [...document.querySelectorAll('[name="cf-turnstile-response"]')].map((field) => ({ tag: field.tagName, valueLength: field.value?.length ?? 0 })),
    widgetText: document.querySelector('.cf-turnstile')?.textContent ?? '',
  }));
  await page.screenshot({ path: '.qa/austin-contact-turnstile.png', fullPage: true });
  console.error(JSON.stringify({ formConsoleErrors, diagnostics }, null, 2));
  throw error;
}
await page.fill('[name="firstName"]', 'Staging');
await page.fill('[name="lastName"]', 'QA');
await page.fill('[name="phone"]', '5125550100');
await page.fill('[name="email"]', 'qa@example.com');
await page.fill('[name="zip"]', '78701');
await page.selectOption('[name="service"]', { index: 1 });
await page.fill('[name="message"]', 'Automated staging verification only.');
await page.click('button[type="submit"]');
await page.waitForFunction(() => {
  const text = document.querySelector('[data-form-status]')?.textContent ?? '';
  return text.length > 0 && !text.includes('Sending your request');
}, { timeout: 30000 });
const statusText = await page.locator('[data-form-status]').innerText();
const smsChecked = await page.locator('[name="smsConsent"]').isChecked();

const result = {
  runDate: new Date().toISOString(),
  consoleChecks,
  form: {
    url,
    pageStatus: response?.status() ?? null,
    statusText,
    smsChecked,
    intakeResponse,
  },
};
await browser.close();
await writeFile('.qa/live-intake.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (consoleChecks.some((check) => check.status !== 200 || check.errors.length) || response?.status() !== 200 || !statusText.includes('Request received.') || smsChecked) {
  process.exitCode = 1;
}
