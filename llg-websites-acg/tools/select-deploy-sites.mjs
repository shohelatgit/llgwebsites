import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const portfolio = JSON.parse(readFileSync(new URL('../data/sites.json', import.meta.url), 'utf8'));
const sites = portfolio.sites.map((site) => ({
  siteKey: site.siteKey,
  brand: site.brand,
  directory: site.directory,
  project: site.directory.toLowerCase(),
}));

function flag(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function allZeroSha(value) {
  return /^0+$/.test(value ?? '');
}

function changedFiles(base, head) {
  if (!base || !head || allZeroSha(base)) return null;
  try {
    return execFileSync('git', ['diff', '--name-only', base, head, '--'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`Could not resolve the requested Git range; selecting all sites. ${detail}`);
    return null;
  }
}

const requested = flag('--site', process.env.DEPLOY_SITE ?? 'changed').trim().toLowerCase();
const base = flag('--base', process.env.BASE_SHA ?? '');
const head = flag('--head', process.env.HEAD_SHA ?? 'HEAD');
let selected;

if (requested === 'all') {
  selected = sites;
} else if (requested && requested !== 'changed') {
  const match = sites.find((site) => [site.siteKey, site.directory, site.project]
    .some((value) => value.toLowerCase() === requested));
  if (!match) {
    console.error(`Unknown site "${requested}". Use a site key, directory, project name, or "all".`);
    process.exit(1);
  }
  selected = [match];
} else {
  const files = changedFiles(base, head);
  selected = files === null
    ? sites
    : sites.filter((site) => {
      const root = `${site.directory.toLowerCase()}/`;
      return files.some((file) => file.replaceAll('\\', '/').toLowerCase().startsWith(root));
    });
}

const matrix = {
  include: selected.map(({ siteKey, brand, directory, project }) => ({ siteKey, brand, directory, project })),
};
const output = JSON.stringify(matrix);
const summary = selected.length
  ? selected.map((site) => `${site.siteKey} -> ${site.project}`).join(', ')
  : 'No deployable site directories changed.';

console.log(output);
console.log(summary);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${output}\ncount=${selected.length}\n`, 'utf8');
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Cloudflare deployment selection\n\n${selected.length} site(s): ${summary}\n`,
    'utf8',
  );
}
