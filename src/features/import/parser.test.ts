import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { MAX_CELL_CHARACTERS, MAX_COLUMNS, MAX_ROWS, ImportError, listSheets, normalizeRows, parseCsv, parseWorkbook, validateIdentifiers } from './parser';

function getMessage(run: () => unknown): string {
  try { run(); } catch (error) { return error instanceof Error ? error.message : String(error); }
  throw new Error('Expected import to fail.');
}

describe('CSV import', () => {
  it('uses the first non-empty row for headers and preserves values as text', () => {
    const data = parseCsv('\uFEFF\n\r\n Asset ,Code\r\nPump,00123\r\n"Valve, north",A-2\r\n');
    expect(data.columns).toEqual(['Asset', 'Code']);
    expect(data.records.map((record) => record.values.Code)).toEqual(['00123', 'A-2']);
    expect(data.records[1].values.Asset).toBe('Valve, north');
  });

  it('rejects malformed CSV and duplicate or empty headers', () => {
    expect(getMessage(() => parseCsv('id,name\n1,"unfinished'))).toMatch(/Malformed CSV/);
    expect(getMessage(() => parseCsv('id,id\n1,2'))).toMatch(/Duplicate header/);
    expect(getMessage(() => parseCsv('id,\n1,2'))).toMatch(/Header 2 is empty/);
  });

  it('accepts one-column CSV and rejects populated data without headers', () => {
    expect(parseCsv('identifier\n001')).toMatchObject({ columns: ['identifier'] });
    expect(getMessage(() => parseCsv('\nvalue\n'))).toMatch(/no data rows/);
  });

  it('rejects long cells, excess rows, and excess columns', () => {
    expect(getMessage(() => parseCsv(`id\n${'x'.repeat(MAX_CELL_CHARACTERS + 1)}`))).toMatch(/character limit/);
    const tooManyRows = `id\n${Array.from({ length: MAX_ROWS + 1 }, (_, index) => index).join('\n')}`;
    expect(getMessage(() => parseCsv(tooManyRows))).toMatch(/data row limit/);
    expect(getMessage(() => parseCsv(`${Array.from({ length: MAX_COLUMNS + 1 }, (_, index) => `c${index}`).join(',')}\n${Array(MAX_COLUMNS + 1).fill('x').join(',')}`))).toMatch(/column limit/);
  });

  it('enforces the byte limit', () => {
    expect(getMessage(() => parseCsv('x'.repeat(10 * 1024 * 1024 + 1)))).toMatch(/10 MiB/);
  });
});

describe('row normalization', () => {
  it('keeps special header keys in null-prototype maps', () => {
    const dataset = normalizeRows([['__proto__', 'constructor'], ['safe', 'field']]);
    expect(Object.getPrototypeOf(dataset.records[0].values)).toBeNull();
    expect(dataset.records[0].values.__proto__).toBe('safe');
    expect(dataset.columns).toEqual(['__proto__', 'constructor']);
  });

  it('records source header whitespace and counts skipped empty rows without changing duplicate rejection', () => {
    const data = normalizeRows([[' Asset  ID ', 'Name'], ['A-1', 'Pump'], ['', '  '], ['A-2', 'Valve']]);
    expect(data.importAudit).toEqual({ sourceHeaders: [' Asset  ID ', 'Name'], removedEmptyRows: 1 });
    expect(getMessage(() => normalizeRows([[' ID ', 'ID'], ['a', 'b']]))).toMatch(/Duplicate header/);
  });

  it('warns for empty columns and rejects data beyond the header', () => {
    expect(normalizeRows([['id', 'unused'], ['1', '']]).warnings).toEqual(['Empty columns: unused.']);
    expect(getMessage(() => normalizeRows([['id'], ['1', '', 'extra']]))).toMatch(/beyond the 1 declared headers/);
  });

  it('warns about long cells and limits the number of identifier diagnostics', () => {
    const longData = normalizeRows([['id', 'note'], ['1', 'x'.repeat(501)]]);
    expect(longData.warnings[0]).toMatch(/1 cell exceed 500 characters/);
    const duplicates = normalizeRows([['id'], ...Array.from({ length: 25 }, () => ['repeat'])]);
    expect(validateIdentifiers(duplicates, 'id')).toHaveLength(11);
    expect(validateIdentifiers(duplicates, 'id').at(-1)).toMatch(/additional identifier issues omitted/);
  });

  it('rejects cells over the limit', () => {
    expect(getMessage(() => normalizeRows([['value'], ['x'.repeat(MAX_CELL_CHARACTERS + 1)]]))).toMatch(/character limit/);
  });
});

describe('Excel import', () => {
  it('lists sheets and imports only the selected sheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['id', 'name'], ['001', 'Pump']]), 'Assets');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['bad', 'header'], ['a', 'b']]), 'Other');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(listSheets(buffer)).toEqual(['Assets', 'Other']);
    expect(parseWorkbook(buffer, 'Assets').records[0].values.id).toBe('001');
    expect(getMessage(() => parseWorkbook(buffer, 'Missing'))).toMatch(/was not found/);
  });

  it('rejects malformed input and leaves unevaluated formula cells empty', () => {
    expect(getMessage(() => listSheets(new TextEncoder().encode('this is not a workbook').buffer))).toMatch(/valid XLSX or XLS/);
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['id', 'calc'], ['a', null]]);
    sheet.B2 = { t: 'n', f: '1+1' };
    XLSX.utils.book_append_sheet(workbook, sheet, 'Formula');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(parseWorkbook(buffer, 'Formula').records[0].values.calc).toBe('');
  });

  it('rejects excessive declared sheet ranges before conversion', () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['id'], ['1']]);
    sheet['!ref'] = `A1:A${MAX_ROWS + 2}`;
    XLSX.utils.book_append_sheet(workbook, sheet, 'Huge');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(getMessage(() => parseWorkbook(buffer, 'Huge'))).toMatch(/data row limit/);
  });
});

describe('identifier validation', () => {
  const data = normalizeRows([['asset_id', 'name'], ['A-1', 'one'], ['', 'two'], ['A-1', 'three']]);

  it('reports absent fields, empty identifiers, and duplicates', () => {
    expect(validateIdentifiers(data, 'missing')).toEqual(['Identifier column "missing" does not exist.']);
    expect(validateIdentifiers(data, 'asset_id')).toEqual([
      'Row 2 has no value for identifier "asset_id".',
      'Row 3 duplicates identifier "A-1" from row 1.',
    ]);
  });
});

it('exposes ImportError as an Error for consumers', () => {
  expect(new ImportError('message')).toBeInstanceOf(Error);
});
