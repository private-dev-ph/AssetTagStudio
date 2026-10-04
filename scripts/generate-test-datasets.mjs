import { createHash } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const headers = ['asset_id', 'name', 'serial', 'location', 'department', 'status', 'notes'];
const kinds = ['Laptop', 'Monitor', 'Router', 'Pump', 'Oscilloscope', 'Tool cabinet'];
const departments = ['IT', 'Engineering', 'Maintenance', 'QA', 'Warehouse'];
const maxBytes = 10 * 1024 * 1024;

function assets(count) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return [
      `AST-${String(number).padStart(6, '0')}`, `${kinds[index % kinds.length]} ${number}`,
      `SN${String(number).padStart(8, '0')}`, `Building ${index % 4 + 1} / Room ${index % 40 + 1}`,
      departments[index % departments.length], index % 10 === 0 ? 'Maintenance due' : 'In service',
      `Synthetic test asset ${number}`,
    ];
  });
}

function csv(rows) {
  return Buffer.from(`${Papa.unparse(rows, { newline: '\r\n' })}\r\n`, 'utf8');
}

// Exactly 10 MiB without violating the row, column or cell limits.
function fileSizeBoundary() {
  const header = 'asset_id,name,notes\r\n';
  const count = 10_000;
  const lines = Array.from({ length: count }, (_, index) => `BYTE-${String(index + 1).padStart(5, '0')},Byte boundary,`);
  const fixed = Buffer.byteLength(header) + lines.reduce((sum, line) => sum + Buffer.byteLength(line) + 2, 0);
  const available = maxBytes - fixed;
  const perCell = Math.floor(available / count);
  const remainder = available % count;
  return Buffer.from(header + lines.map((line, index) => `${line}${'x'.repeat(perCell + (index < remainder ? 1 : 0))}\r\n`).join(''));
}

function workbook(sheets, bookType = 'xlsx') {
  const book = XLSX.utils.book_new();
  book.Props = { Title: 'Synthetic AssetTag Studio fixtures', Author: 'AssetTag Studio', CreatedDate: new Date('2026-01-01T00:00:00Z') };
  for (const [name, rows] of sheets) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  return { book, bytes: () => XLSX.write(book, { type: 'buffer', bookType, compression: true }) };
}

export function buildTestDatasets() {
  const files = [];
  const add = (name, data, purpose, expectations) => files.push({ name, data, purpose, expectations });
  const goodCsv = (name, rows, purpose, extra = {}) => add(name, csv(rows), purpose, [{ rows: rows.length - 1, columns: rows[0].length, ...extra }]);
  const badCsv = (name, data, purpose, error) => add(name, typeof data === 'string' ? Buffer.from(data) : data, purpose, [{ error }]);

  for (const count of [100, 1_000, 5_000, 20_000]) {
    goodCsv(`assets-${count}-unique.csv`, [headers, ...assets(count)], 'Unique identifiers and label values; import, search, pagination and progressively larger exports.', { identifierIssues: 0 });
  }
  goodCsv('assets-20000-repeated-labels.csv', [['asset_id', 'name', 'serial'], ...Array.from({ length: 20_000 }, () => ['REPEAT-001', 'Repeated label', 'SN00000001'])],
    'All label values are identical. Compare rendering cache behavior with 20,000 unique labels; duplicate identifiers are intentional.', { identifierIssues: 11 });
  badCsv('reject-20001-rows.csv', csv([headers, ...assets(20_001)]), 'One data row beyond the hard row limit.', 'data row limit');
  const atBytes = fileSizeBoundary();
  add('boundary-10MiB.csv', atBytes, 'Exactly 10 MiB, 10,000 rows; long notes produce warnings. Hide notes before rendering.', [{ rows: 10_000, columns: 3, warning: 'exceed 500', identifierIssues: 0 }]);
  badCsv('reject-10MiB-plus-one-byte.csv', Buffer.concat([atBytes, Buffer.from('\n')]), 'Exactly one byte beyond the file-size limit.', '10 MiB');
  for (const count of [100, 101]) {
    const columns = ['asset_id', ...Array.from({ length: count - 1 }, (_, index) => `field_${index + 1}`)];
    const rows = [columns, ...Array.from({ length: 10 }, (_, index) => [`WIDE-${index + 1}`, ...Array.from({ length: count - 1 }, (_, column) => `value-${index + 1}-${column + 1}`)])];
    if (count === 100) goodCsv('boundary-100-columns.csv', rows, '100 import columns are allowed. Show only a few label fields; a label supports at most 32 text fields.');
    else badCsv('reject-101-columns.csv', csv(rows), 'One column beyond the import limit.', 'column limit');
  }
  goodCsv('boundary-10000-character-cell.csv', [['asset_id', 'name', 'notes'], ['LONG-001', 'Cell boundary', 'A'.repeat(10_000)]],
    'Accepted with a long-cell warning. Hide notes and encode asset_id; encoding notes exceeds the separate 2,000-character code limit.', { warning: 'exceed 500' });
  badCsv('reject-10001-character-cell.csv', csv([['asset_id', 'notes'], ['LONG-002', 'A'.repeat(10_001)]]), 'One character beyond the cell limit.', 'character limit');
  goodCsv('unicode-and-leading-zeroes.csv', [
    ['asset_id', 'name', 'serial', 'location'],
    ['000001', 'Café analyzer', '00000042', 'München'],
    ['设备-002', '温度传感器', '00000043', '上海'],
    ['機器-003', '測定器', '00000044', '東京'],
    ['أصل-004', 'جهاز قياس', '00000045', 'مختبر'],
    ['LAB-005', 'Microscope 🔬', '00000046', 'Lab α'],
  ], 'Leading zeroes, international text, emoji and Unicode QR values. For Code128 choose the ASCII serial field.');
  goodCsv('quoted-fields-and-line-breaks.csv', [
    ['asset_id', 'name', 'notes'], ['QUOTE-001', 'Valve, north', 'He said "inspect weekly"'],
    ['QUOTE-002', 'Two-line note', 'First line\r\nSecond line'], ['QUOTE-003', 'Comma, quote " and newline', 'Trailing spaces   '],
  ], 'CSV escaping, embedded commas/quotes/newlines and preserved trailing spaces.');
  goodCsv('identifier-warnings.csv', [['asset_id', 'name', 'serial'],
    ['DUP-001', 'First', 'SER-001'], ['', 'Missing identifier', 'SER-002'],
    ['DUP-001', 'Duplicate identifier', 'SER-003'], [' DUP-001 ', 'Whitespace duplicate', 'SER-004'],
    ['OK-005', 'Valid', 'SER-005']], 'Import succeeds, asset_id has three identifier issues. Choose serial for a clean export.', { identifierIssues: 3 });
  goodCsv('empty-column-warning.csv', [['asset_id', 'name', 'unused'], ['EMPTY-001', 'Pump', ''], ['EMPTY-002', 'Valve', '']], 'Import succeeds with an empty-column warning.', { warning: 'Empty columns' });
  goodCsv('special-headers-and-literal-html.csv', [['asset_id', '__proto__', 'constructor', 'toString', 'name'],
    ['SAFE-001', 'ordinary column', 'also ordinary', 'plain value', '<img src=x onerror="alert(1)">'],
    ['SAFE-002', 'another value', 'still ordinary', 'plain value', '<script>alert(1)</script>']],
    'Prototype-like headers must remain ordinary columns; HTML strings display literally without execution.');
  badCsv('reject-duplicate-headers.csv', 'asset_id,name,name\r\nDUP-001,First,Second\r\n', 'Repeated column name.', 'Duplicate header');
  badCsv('reject-empty-header.csv', 'asset_id,,name\r\nEMPTY-001,x,Pump\r\n', 'An unnamed column.', 'Header 2 is empty');
  badCsv('reject-extra-populated-cell.csv', 'asset_id,name\r\nEXTRA-001,Pump,unexpected\r\n', 'Populated cell beyond declared headers.', 'beyond');
  badCsv('reject-unclosed-quote.csv', 'asset_id,name\r\nQUOTE-001,"unfinished', 'Malformed quoting.', 'Malformed CSV');
  badCsv('reject-header-only.csv', 'asset_id,name\r\n', 'Headers without records.', 'no data rows');
  badCsv('reject-empty-file.csv', '\r\n\r\n', 'Blank file.', 'empty');
  goodCsv('qr-dense-payload.csv', [['asset_id', 'name', 'payload'], ['QR-001', 'Dense QR test', 'https://inventory.example.invalid/assets/' + 'a'.repeat(1_450)]],
    'Encode payload with a 20 mm QR: expected density error. Shorten payload or enlarge label/code; .invalid is a reserved non-production domain.', { warning: 'exceed 500' });
  goodCsv('reject-code-payload-after-import.csv', [['asset_id', 'name', 'payload'], ['PAYLOAD-001', 'Overlong code', 'A'.repeat(2_001)]],
    'Import succeeds; encoding payload rejects the separate 2,000-character code limit. Encoding asset_id succeeds.', { warning: 'exceed 500' });
  goodCsv('code128-overwide-value.csv', [['asset_id', 'name', 'payload'], ['BAR-001', 'Wide barcode test', 'ABC'.repeat(600)]],
    'Import succeeds; choose Code128 and encode payload to exercise pre-allocation width rejection.', { warning: 'exceed 500' });

  const multi = workbook([
    ['Assets', [headers, ...assets(50)]], ['International', [['asset_id', 'name'], ['设备-001', '传感器'], ['LAB-002', 'Café analyzer']]],
    ['Empty', []], ['Duplicate headers', [['asset_id', 'name', 'name'], ['DUP-001', 'A', 'B']]],
    ['Stored formula values', [['asset_id', 'calculated', 'no_cached_value'], ['FORMULA-001', 42, null]]],
  ]);
  multi.book.Sheets['Stored formula values'].B2 = { t: 'n', f: '6*7', v: 42 };
  multi.book.Sheets['Stored formula values'].C2 = { t: 'n', f: '1+1' };
  add('workbook-multiple-sheets.xlsx', multi.bytes(), 'Switch among valid and invalid worksheets; verify no stale records after failed sheet selection. Formula expressions are not evaluated.', [
    { sheet: 'Assets', rows: 50, columns: 7, identifierIssues: 0 }, { sheet: 'International', rows: 2, columns: 2 },
    { sheet: 'Empty', error: 'empty' }, { sheet: 'Duplicate headers', error: 'Duplicate header' },
    { sheet: 'Stored formula values', rows: 1, columns: 3, warning: 'Empty columns' },
  ]);
  const large = workbook([['Assets', [headers, ...assets(5_000)]]]);
  add('assets-5000.xlsx', large.bytes(), 'Larger compressed Excel input; compare worker import time with the 5,000-row CSV.', [{ sheet: 'Assets', rows: 5_000, columns: 7, identifierIssues: 0 }]);
  const legacy = workbook([['Assets', [headers, ...assets(100)]]], 'xls');
  add('assets-100-legacy.xls', legacy.bytes(), 'Valid legacy XLS/CFB workbook.', [{ sheet: 'Assets', rows: 100, columns: 7, identifierIssues: 0 }]);
  add('reject-fake-workbook.xlsx', Buffer.from('This is deliberately not a workbook.\r\n'), 'Wrong binary signature, not a compressed attack archive.', [{ error: 'valid XLSX or XLS' }]);
  return files;
}

export async function generateTestDatasets(output = path.join(root, 'docs/test-data/generated/files')) {
  await mkdir(output, { recursive: true });
  const files = buildTestDatasets();
  for (const file of files) await writeFile(path.join(output, file.name), file.data);
  const manifest = {
    synthetic: true,
    limits: { bytes: maxBytes, rows: 20_000, columns: 100, cellCharacters: 10_000, codeCharacters: 2_000 },
    files: files.map(({ data, ...file }) => ({ ...file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') })),
  };
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await copyFile(path.join(root, 'docs/test-data/README.md'), path.join(output, 'README.md'));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  const manifest = await generateTestDatasets(output);
  console.log(`Generated ${manifest.files.length} synthetic files in ${output ?? path.join(root, 'docs/test-data/generated/files')}`);
  console.log(`Total uncompressed input bytes: ${manifest.files.reduce((sum, file) => sum + file.bytes, 0).toLocaleString()}`);
}
