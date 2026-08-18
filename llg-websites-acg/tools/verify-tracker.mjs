import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const input = resolve(process.argv[2] ?? 'tracker/LLG Site Rebuild Tracker - Portfolio Perfection.xlsx');
const outputDir = resolve(process.argv[3] ?? '.qa/tracker');
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
await mkdir(outputDir, { recursive: true });
const sheetNames = ['Portfolio tracker', 'Source data', 'Overview', 'Production gates', 'Style map'];
const previews = [];
for (const sheetName of sheetNames) {
  const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
  const target = resolve(outputDir, `${sheetName.toLowerCase().replaceAll(' ', '-')}.png`);
  await writeFile(target, new Uint8Array(await preview.arrayBuffer()));
  previews.push(target);
}
const overviewCheck = await workbook.inspect({
  kind: 'table',
  range: "'Overview'!A1:B18",
  include: 'values,formulas',
  tableMaxRows: 20,
  tableMaxCols: 4,
});
const trackerCheck = await workbook.inspect({
  kind: 'table',
  range: "'Portfolio tracker'!A1:Y30",
  include: 'values,formulas',
  tableMaxRows: 30,
  tableMaxCols: 25,
});
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
});
const tracker = workbook.worksheets.getItem('Portfolio tracker').getRange('A1:Y30').values;
console.log(JSON.stringify({
  file: basename(input),
  sheets: workbook.worksheets.items.map((sheet) => sheet.name),
  rows: tracker.length - 1,
  columns: tracker[0].length,
  overview: overviewCheck.ndjson,
  tracker: trackerCheck.ndjson,
  formulaErrors: errors.ndjson,
  previews,
}));
