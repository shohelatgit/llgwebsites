const fs = require('fs');
const path = require('path');
const { writeManifest } = require('./worker-site-manifest');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'out', 'worker-site-index');
const PALETTES_FILE = path.join(ROOT, 'review', 'homepage-palettes', 'palettes.json');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function titleCase(value) {
  return value.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function build() {
  const manifest = writeManifest();
  const palettes = JSON.parse(fs.readFileSync(PALETTES_FILE, 'utf8'));
  const paletteNames = new Map(palettes.map((palette) => [palette.id, palette.name]));
  const groups = new Map();
  for (const site of manifest.sites) {
    if (!groups.has(site.profileId)) groups.set(site.profileId, []);
    groups.get(site.profileId).push(site);
  }
  for (const sites of groups.values()) sites.sort((a, b) => a.primaryMarket.localeCompare(b.primaryMarket));

  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([profileId, sites]) => `
      <section class="site-group" data-group="${escapeHtml(profileId)}">
        <div class="group-heading">
          <h2>${escapeHtml(titleCase(profileId))}</h2>
          <span>${sites.length} sites</span>
        </div>
        <div class="site-grid">
${sites.map((site) => `
            <article class="site-card" data-search="${escapeHtml(`${site.businessName} ${site.domain} ${site.primaryMarket} ${site.state}`.toLowerCase())}">
              <p class="eyebrow">${escapeHtml(site.primaryMarket)}${site.state ? `, ${escapeHtml(site.state)}` : ''}</p>
              <h3>${escapeHtml(site.businessName)}</h3>
              <p class="domain">${escapeHtml(site.domain)}</p>
              <p class="meta">${escapeHtml(paletteNames.get(site.themeId) || titleCase(site.themeId))}</p>
              <a href="${escapeHtml(site.reviewUrl)}" target="_blank" rel="noopener">Open review site <span aria-hidden="true">↗</span></a>
            </article>`).join('')}
        </div>
      </section>`).join('');

  const pendingRows = manifest.pending.map((site) => `
    <tr><td>${escapeHtml(site.businessName)}</td><td>${escapeHtml(site.domain)}</td><td>${escapeHtml(site.niche || 'Unmatched')}</td></tr>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>LLG Site Review Index</title>
  <style>
    :root{color-scheme:light;--ink:#101828;--muted:#667085;--line:#d0d5dd;--surface:#fff;--wash:#f2f4f7;--brand:#175cd3}*{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink);font:16px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{background:#0b1220;color:#fff;padding:44px 20px}header>div,main{width:min(1180px,100%);margin:auto}.kicker{margin:0 0 8px;color:#84adff;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.78rem}h1{font-size:clamp(2rem,5vw,3.6rem);line-height:1.02;margin:0 0 12px}header p{max-width:720px;color:#d0d5dd;margin:0}.summary{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.summary span{background:#1d2939;border:1px solid #344054;border-radius:999px;padding:8px 12px;font-size:.9rem}main{padding:28px 20px 64px}.toolbar{position:sticky;top:0;z-index:2;background:rgba(242,244,247,.94);backdrop-filter:blur(10px);padding:12px 0 20px}.toolbar input{width:100%;border:1px solid var(--line);border-radius:12px;padding:14px 16px;font:inherit;background:#fff}.site-group{margin:22px 0 40px}.group-heading{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);margin-bottom:16px}.group-heading h2{margin:0 0 10px}.group-heading span{color:var(--muted)}.site-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.site-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:0 1px 2px rgba(16,24,40,.04)}.site-card h3{margin:4px 0;font-size:1.05rem}.eyebrow,.domain,.meta{margin:0}.eyebrow{color:var(--brand);font-weight:700;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}.domain{color:var(--muted);word-break:break-word}.meta{margin-top:12px;color:var(--muted);font-size:.85rem}.site-card a{display:inline-block;margin-top:16px;color:var(--brand);font-weight:700;text-decoration:none}.pending{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}.pending h2,.pending>p{padding:0 18px}.pending h2{margin-top:18px}.pending>p{color:var(--muted)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 18px;border-top:1px solid var(--line)}th{font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.hidden{display:none!important}@media(max-width:850px){.site-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){header{padding-top:30px}.site-grid{grid-template-columns:1fr}.group-heading{align-items:center}.pending{overflow-x:auto}th,td{min-width:150px}}
  </style>
</head>
<body>
  <header><div>
    <p class="kicker">LLG site factory</p>
    <h1>Portfolio review index</h1>
    <p>Independently deployed Cloudflare review sites. These URLs are intentionally no-indexed. Forms use test-mode intake and production lead delivery remains disabled until approval.</p>
    <div class="summary"><span>${manifest.summary.eligibleSites} live review sites</span><span>${manifest.summary.pendingProfileSites} profile pending</span><span>${groups.size} industry profiles</span></div>
  </div></header>
  <main>
    <div class="toolbar"><label><span class="kicker" style="color:#344054">Find a site</span><input id="search" type="search" placeholder="Search business, domain, city, or state" autocomplete="off"></label></div>
    <div id="groups">${sections}</div>
    <section class="pending">
      <h2>Profile pending</h2>
      <p>These records were not published because the factory does not yet have a matched service profile for them.</p>
      <table><thead><tr><th>Business</th><th>Domain</th><th>Current niche</th></tr></thead><tbody>${pendingRows}</tbody></table>
    </section>
  </main>
  <script>
    const input=document.querySelector('#search');
    input.addEventListener('input',()=>{const query=input.value.trim().toLowerCase();document.querySelectorAll('.site-card').forEach(card=>card.classList.toggle('hidden',query&&!card.dataset.search.includes(query)));document.querySelectorAll('.site-group').forEach(group=>group.classList.toggle('hidden',![...group.querySelectorAll('.site-card')].some(card=>!card.classList.contains('hidden'))));});
  </script>
</body>
</html>`;

  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'index.html'), html);
  fs.writeFileSync(path.join(OUTPUT_ROOT, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n');
  const csv = [
    ['source_id', 'business_name', 'domain', 'profile', 'market', 'state', 'theme', 'worker_name', 'review_url'],
    ...manifest.sites.map((site) => [site.sourceId, site.businessName, site.domain, site.profileId, site.primaryMarket, site.state, site.themeId, site.workerName, site.reviewUrl]),
  ].map((row) => row.map(csvCell).join(',')).join('\r\n');
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'sites.csv'), `${csv}\r\n`);
  console.log(`Built review index for ${manifest.sites.length} sites at ${OUTPUT_ROOT}`);
}

build();
