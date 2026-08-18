const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { writeManifest } = require('./worker-site-manifest');

const ROOT = path.resolve(__dirname, '..');
const ENTRYPOINT = path.join(ROOT, 'workers', 'site-review-proxy.mjs');
const STATUS_FILE = path.join(ROOT, 'out', 'worker-site-deployments.json');
const WRANGLER_CLI = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function parseArgs(argv) {
  const options = { concurrency: 3, limit: null, site: null, dryRun: false, production: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--production') options.production = true;
    else if (arg === '--limit') options.limit = Number(argv[++index]);
    else if (arg === '--site') options.site = argv[++index];
    else if (arg === '--concurrency') options.concurrency = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 6) {
    throw new Error('Concurrency must be an integer from 1 to 6.');
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('Limit must be a positive integer.');
  }
  if (options.production && !options.site) {
    throw new Error('Production deployment requires an explicit --site value.');
  }
  return options;
}

function loadStatus() {
  if (!fs.existsSync(STATUS_FILE)) return { updatedAt: null, deployments: {} };
  return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
}

function saveStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  status.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`);
}

function deploy(site, options) {
  return new Promise((resolve) => {
    const liveRelease = site.launchEnabled || options.production;
    const args = [
      WRANGLER_CLI, 'deploy', ENTRYPOINT,
      '--name', site.workerName,
      '--compatibility-date', '2026-08-17',
      '--var', `PROFILE_ID:${site.profileId}`,
      '--var', `SITE_ID:${site.sourceId}`,
      '--var', `THEME_ID:${site.themeId}`,
      '--var', `SITE_CONFIG:${JSON.stringify(site.sourceConfig)}`,
      '--var', `INDEX_STATE:${liveRelease ? 'production' : 'preview'}`,
      '--message', `LLG factory ${liveRelease ? 'live' : 'review'} release for ${site.domain}`,
      '--minify',
    ];
    if (options.dryRun) args.push('--dry-run');

    const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ ok: false, error: error.message, stdout, stderr }));
    child.on('close', (code) => resolve({
      ok: code === 0,
      code,
      stdout,
      stderr,
      error: code === 0 ? null : (stderr || stdout).trim().slice(-2000),
    }));
  });
}

async function runPool(sites, options, status) {
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < sites.length) {
      const index = cursor;
      cursor += 1;
      const site = sites[index];
      console.log(`[${index + 1}/${sites.length}] Deploying ${site.domain} as ${site.workerName}`);
      const liveRelease = site.launchEnabled || options.production;
      if (options.production && !site.launchEnabled) {
        throw new Error(`Production deployment blocked: ${site.domain} is not in config/production-launch.json.`);
      }
      if (liveRelease && !site.turnstileSiteKey) {
        throw new Error(`Production deployment blocked: ${site.domain} has no real Turnstile widget assignment.`);
      }
      const result = await deploy(site, options);
      completed += 1;
      status.deployments[site.sourceId] = {
        sourceId: site.sourceId,
        domain: site.domain,
        workerName: site.workerName,
        reviewUrl: site.reviewUrl,
        deployedAt: new Date().toISOString(),
        releaseMode: liveRelease ? 'live' : 'review',
        status: result.ok ? (options.dryRun ? 'dry-run-ok' : 'deployed') : 'failed',
        error: result.error,
      };
      saveStatus(status);
      console.log(`[${completed}/${sites.length}] ${result.ok ? 'OK' : 'FAILED'} ${site.reviewUrl}`);
      if (!result.ok && result.error) console.error(result.error);
    }
  }

  await Promise.all(Array.from({ length: Math.min(options.concurrency, sites.length) }, () => worker()));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = writeManifest();
  let sites = manifest.sites;
  if (options.site) {
    sites = sites.filter((site) => site.sourceId === options.site || site.domain === options.site || site.workerName === options.site);
    if (!sites.length) throw new Error(`No eligible site matched: ${options.site}`);
  }
  if (options.limit !== null) sites = sites.slice(0, options.limit);

  const status = loadStatus();
  await runPool(sites, options, status);

  const selected = new Set(sites.map((site) => site.sourceId));
  const results = Object.values(status.deployments).filter((item) => selected.has(item.sourceId));
  const failures = results.filter((item) => item.status === 'failed');
  console.log(`Deployment run complete: ${results.length - failures.length} succeeded, ${failures.length} failed.`);
  console.log(STATUS_FILE);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
