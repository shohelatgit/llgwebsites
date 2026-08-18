import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = process.env.LLG_TRACKER_OUTPUT
  ? pathToFileURL(resolve(process.env.LLG_TRACKER_OUTPUT))
  : new URL('../tracker/LLG%20Site%20Rebuild%20Tracker%20-%20Portfolio%20Perfection.xlsx', import.meta.url);
const portfolio = JSON.parse(await readFile(new URL('../data/sites.json', import.meta.url), 'utf8'));

const retained = {
  'connecticut-drain-pros': ['69 local target photos plus generated trade imagery', 'Original target review wording retained'],
  'dallas-drain-guys': ['32 local target photos plus generated trade imagery', 'Original target review wording retained'],
  'louisville-precision-walls': ['76 local target photos plus generated trade imagery', 'Original target review wording retained'],
  'morgantown-fence-pros': ['5 localized target photos plus generated trade imagery', 'Original target review wording retained'],
  'pittsburgh-french-drain': ['45 local target photos plus generated trade imagery', 'Original target review wording retained'],
};
const domainExceptions = {
  'nashville-crawlspace': 'No exact portfolio-workbook domain match; business facts must be supplied or reverified.',
  'pittsburgh-french-drain': 'Workbook used pghfrenchdrains.com (plural); target is pghfrenchdrain.com. Reverify domain, phone and GBP.',
};

const headers = [
  'Site', 'Site key', 'Target domain', 'Trade', 'Primary market', 'Brand board', 'Assigned clone',
  'Palette', 'Heading / body type', 'Logo status', 'Photo inventory', 'Review inventory', 'pSEO system',
  'Metadata / schema', 'Form route', 'Phone route', 'SMS', 'GBP evidence', 'Desktop / mobile QA',
  'Live route QA', 'Preview URL', 'Production target', 'Index state', 'Release state', 'Blocking work / notes',
];

const rows = portfolio.sites.map((site) => {
  const project = site.directory.toLowerCase();
  const [photos, reviews] = retained[site.siteKey] ?? [
    '3 generated trade images from prior LLG workspace; provenance recorded',
    'Three site-specific customer review excerpts are present; source records remain a production gate',
  ];
  const palette = Object.entries(site.brandSystem.colors).map(([role, value]) => `${role}: ${value}`).join(' | ');
  const type = `${site.brandSystem.typography.heading.family} / ${site.brandSystem.typography.body.family}`;
  const phoneRoute = site.contact.phoneStatus === 'callrail-active'
    ? `Verified CallRail tracker: ${site.contact.phone}`
    : site.contact.phoneStatus === 'callrail-shared'
      ? `CallRail tracker routes, but ${site.contact.phone} is shared; attribution conflict must be resolved`
      : `Form-only preview; ${site.contact.phone} is not in the CallRail inventory and needs a tracker`;
  const blockers = [
    ...site.indexing.blockers,
    retained[site.siteKey] ? null : 'review source records and site-specific project photos',
    site.contact.phoneStatus === 'callrail-active' ? null : phoneRoute,
    'production performance trace',
    domainExceptions[site.siteKey] ?? null,
  ].filter(Boolean).join('; ');
  return [
    site.brand,
    site.siteKey,
    site.domain,
    site.trade,
    `${site.city}, ${site.state}`,
    site.brandSystem.boardFile,
    site.clone.label,
    palette,
    type,
    'Approved brand-board primary mark, icon and favicon extracted locally; vector/reversed variants remain optional production refinements',
    photos,
    reviews,
    `${site.pages.length} crawlable pages; four service pages; primary city only; adjacent-city pages blocked`,
    'Unique title, description and H1; breadcrumbs; Organization/WebSite/Service schema; no rating schema; staging canonical omitted',
    'Verified: Turnstile -> Worker /v1/website-leads -> Supabase provider ingest; live test lead recorded',
    phoneRoute,
    'Optional checkbox unchecked; automated texting disabled',
    `${site.gbp.status}; source: portfolio workbook; production recheck required`,
    'Pass: 1440x900, 390x844, 320x780; no overflow or broken images',
    'Pass: all pages, robots and sitemap; portfolio total 406/406 after current redeploy',
    `https://clone-rebuild.${project}.pages.dev`,
    `https://${site.domain} (not promoted)`,
    'noindex, nofollow; empty staging sitemap; no staging canonical',
    'Preview deployed and QA passed; production held',
    blockers,
  ];
});

const wb = Workbook.create();
const tracker = wb.worksheets.add('Portfolio tracker');
tracker.getRange('A1:Y1').values = [headers];
tracker.getRange(`A2:Y${rows.length + 1}`).values = rows;
tracker.getRange('A1:Y1').format = { fill: '#102A43', font: { bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
tracker.getRange(`A2:Y${rows.length + 1}`).format = { verticalAlignment: 'top', wrapText: true };
tracker.getRange('A1:Y1').format.rowHeight = 44;
tracker.getRange(`A2:Y${rows.length + 1}`).format.rowHeight = 76;
tracker.getRange(`A1:Y${rows.length + 1}`).format.borders = { style: 'continuous', color: '#D9E2EC' };
tracker.getRange('A:Y').format.columnWidth = 20;
tracker.getRange('A:A').format.columnWidth = 27;
tracker.getRange('B:C').format.columnWidth = 29;
tracker.getRange('F:G').format.columnWidth = 27;
tracker.getRange('H:I').format.columnWidth = 38;
tracker.getRange('J:L').format.columnWidth = 38;
tracker.getRange('M:N').format.columnWidth = 48;
tracker.getRange('O:Q').format.columnWidth = 43;
tracker.getRange('R:T').format.columnWidth = 42;
tracker.getRange('U:V').format.columnWidth = 48;
tracker.getRange('W:X').format.columnWidth = 38;
tracker.getRange('Y:Y').format.columnWidth = 64;
tracker.tables.add(`A1:Y${rows.length + 1}`, true, 'PortfolioTracker');
tracker.showGridLines = false;
tracker.freezePanes.freezeRows(1);
tracker.freezePanes.freezeColumns(2);
tracker.getRange(`P2:P${rows.length + 1}`).conditionalFormats.add('containsText', {
  text: 'Verified CallRail tracker:',
  format: { fill: '#D9EAD3', font: { color: '#274E13' } },
});
tracker.getRange(`P2:P${rows.length + 1}`).conditionalFormats.add('containsText', {
  text: 'shared',
  format: { fill: '#FFF2CC', font: { color: '#7F6000' } },
});
tracker.getRange(`P2:P${rows.length + 1}`).conditionalFormats.add('containsText', {
  text: 'needs a tracker',
  format: { fill: '#F4CCCC', font: { color: '#990000' } },
});

const sourceData = wb.worksheets.add('Source data');
const sourceHeaders = ['Site key', 'Target domain', 'CallRail status', 'Page count', 'Photo inventory', 'Review inventory'];
const sourceRows = portfolio.sites.map((site) => {
  const [photos, reviews] = retained[site.siteKey] ?? [
    'Generated trade imagery with recorded provenance',
    'Customer review copy present; source record pending',
  ];
  return [site.siteKey, site.domain, site.contact.phoneStatus, site.pages.length, photos, reviews];
});
sourceData.getRange(`A1:F${sourceRows.length + 1}`).values = [sourceHeaders, ...sourceRows];
sourceData.getRange('A1:F1').format = { fill: '#334E68', font: { bold: true, color: '#FFFFFF' } };
sourceData.getRange(`A1:F${sourceRows.length + 1}`).format = { wrapText: true, verticalAlignment: 'top', borders: { style: 'continuous', color: '#D9E2EC' } };
sourceData.getRange('A:B').format.columnWidth = 30;
sourceData.getRange('C:D').format.columnWidth = 21;
sourceData.getRange('E:F').format.columnWidth = 56;
sourceData.getRange('D2:D30').format.numberFormat = '#,##0';
sourceData.tables.add(`A1:F${sourceRows.length + 1}`, true, 'PortfolioSourceData');
sourceData.showGridLines = false;
sourceData.freezePanes.freezeRows(1);

const overview = wb.worksheets.add('Overview');
const overviewRows = [
  ['LLG portfolio perfection', 'Current state'],
  ['Sites', null],
  ['Pages per site', 12],
  ['Generated pages', null],
  ['Preview deployments', null],
  ['Static audit', '29/29 passed'],
  ['Responsive homepage checks', '87/87 passed across 1440, 390 and 320 px'],
  ['Live page / crawl checks', '406/406 passed'],
  ['Live form test', 'Browser -> Turnstile -> Worker -> Supabase: accepted and verified in leads table'],
  ['CallRail: exact active', null],
  ['CallRail: shared/conflicted', null],
  ['CallRail: tracker required', null],
  ['Indexing', 'All previews noindex; production indexing evidence-gated'],
  ['pSEO scope', 'Primary city plus service pages only; no adjacent-city expansion yet'],
  ['Analytics', 'Cloudflare Web Analytics and Search Console at production-domain approval; GA4 not planned initially'],
  ['Credentials policy', 'No recipient addresses, credentials or secrets copied into this workbook or Git'],
  ['Production scope', 'No custom-domain, DNS, canonical or production deployment changes made'],
  ['Performance gate', 'Chrome DevTools performance profiler unavailable in this workspace; trace still required before production'],
];
overview.getRange(`A1:B${overviewRows.length}`).values = overviewRows;
overview.getRange('B2').formulas = [["=COUNTA('Source data'!$A$2:$A$30)"]];
overview.getRange('B4').formulas = [["=SUM('Source data'!$D$2:$D$30)"]];
overview.getRange('B5').formulas = [["=COUNTA('Source data'!$B$2:$B$30)"]];
overview.getRange('B10').formulas = [["=COUNTIF('Source data'!$C$2:$C$30,\"callrail-active\")"]];
overview.getRange('B11').formulas = [["=COUNTIF('Source data'!$C$2:$C$30,\"callrail-shared\")"]];
overview.getRange('B12').formulas = [["=COUNTIF('Source data'!$C$2:$C$30,\"not-in-callrail-inventory\")"]];
overview.getRange('A1:B1').format = { fill: '#102A43', font: { bold: true, color: '#FFFFFF' } };
overview.getRange(`A1:B${overviewRows.length}`).format = { wrapText: true, verticalAlignment: 'top', borders: { style: 'continuous', color: '#D9E2EC' } };
overview.getRange('B3').format = { fill: '#FFF4CC', font: { color: '#7A4E00' }, horizontalAlignment: 'right' };
overview.getRange('B2:B5').format.numberFormat = '#,##0';
overview.getRange('B10:B12').format.numberFormat = '#,##0';
overview.getRange('A:A').format.columnWidth = 38;
overview.getRange('B:B').format.columnWidth = 92;
overview.getRange(`A1:B${overviewRows.length}`).format.rowHeight = 34;
overview.showGridLines = false;
overview.freezePanes.freezeRows(1);

const gates = wb.worksheets.add('Production gates');
const gateRows = [
  ['Gate', 'Required evidence', 'Current state', 'Owner / next action'],
  ['Brand', 'Approved logo files, palette and font licenses', 'Approved brand-board primary mark, icon and favicon extracted; palette/type applied', 'Supply licensed font files and optional vector/reversed variants if required'],
  ['Business identity', 'Approved public operator name, domain, phone, GBP and address facts', 'Workbook candidates imported but not treated as verified', 'Approve public facts per site; resolve Nashville and Pittsburgh exceptions'],
  ['Photos', 'Attributable local project media', 'First five retain local media; all trades also use generated LLG workspace imagery with provenance', 'Replace generated imagery with site-specific project photos as supplied'],
  ['Reviews', 'Approved wording and source records', 'Customer review copy is present on all 29 homepages; first-five source wording retained', 'Attach source records and approve wording before production indexing'],
  ['Lead forms', 'Bot protection, origin validation and durable CRM ingestion', 'Turnstile -> Cloudflare Worker -> Supabase verified end to end', 'Replace test Turnstile keys with production keys before custom-domain promotion'],
  ['Phone', 'Unique CallRail tracker and forwarding test', '21 exact active; 2 shared/conflicted; 6 absent from inventory', 'Provision 6 trackers minimum, or 8 for clean one-number-per-site attribution'],
  ['SMS', 'Compliance-approved messaging program', 'Consent optional and unchecked; automation disabled', 'Separate compliance approval before enabling automated texts'],
  ['pSEO', 'Primary-city and service evidence; no doorway/thin pages', '12-page foundation staged noindex', 'Review service facts and search intent; expand locations only with evidence'],
  ['Technical SEO', 'Canonical/domain approval, final schema facts, Search Console', 'Staging metadata valid; canonical intentionally absent', 'Approve production domain, then generate canonical/sitemap and verify GSC'],
  ['Performance', 'Cold-load trace and Core Web Vitals review', 'Pending: required profiler not configured', 'Run Chrome DevTools trace before promotion'],
  ['Release', 'All preceding gates approved', 'Production held', 'Promote in evidence-ready waves only'],
];
gates.getRange(`A1:D${gateRows.length}`).values = gateRows;
gates.getRange('A1:D1').format = { fill: '#102A43', font: { bold: true, color: '#FFFFFF' } };
gates.getRange(`A1:D${gateRows.length}`).format = { wrapText: true, verticalAlignment: 'top', borders: { style: 'continuous', color: '#D9E2EC' } };
gates.getRange('A:A').format.columnWidth = 24;
gates.getRange('B:D').format.columnWidth = 58;
gates.getRange(`A1:D${gateRows.length}`).format.rowHeight = 46;
gates.showGridLines = false;
gates.freezePanes.freezeRows(1);

const styles = wb.worksheets.add('Style map');
const styleGroups = new Map();
for (const site of portfolio.sites) {
  const list = styleGroups.get(site.clone.label) ?? [];
  list.push(site.brand);
  styleGroups.set(site.clone.label, list);
}
const styleRows = [['Clone style', 'Assigned sites', 'Authority split']];
for (const [clone, sites] of [...styleGroups.entries()].sort()) {
  styleRows.push([clone, sites.join(', '), 'Clone package controls layout/component geometry; target brand board controls palette/type; target-owned content and approved media control claims.']);
}
styles.getRange(`A1:C${styleRows.length}`).values = styleRows;
styles.getRange('A1:C1').format = { fill: '#102A43', font: { bold: true, color: '#FFFFFF' } };
styles.getRange(`A1:C${styleRows.length}`).format = { wrapText: true, verticalAlignment: 'top', borders: { style: 'continuous', color: '#D9E2EC' } };
styles.getRange('A:A').format.columnWidth = 30;
styles.getRange('B:B').format.columnWidth = 76;
styles.getRange('C:C').format.columnWidth = 80;
styles.getRange(`A1:C${styleRows.length}`).format.rowHeight = 52;
styles.showGridLines = false;
styles.freezePanes.freezeRows(1);

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await writeFile(output, xlsx.data);
console.log(`Created ${decodeURIComponent(output.pathname)}`);
