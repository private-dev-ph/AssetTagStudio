import { describe, expect, it } from 'vitest';
import { buildTestDatasets } from '../scripts/generate-test-datasets.mjs';
import { listSheets, parseCsv, parseWorkbook, validateIdentifiers } from '../src/features/import/parser';

type Expected = { sheet?: string; rows?: number; columns?: number; error?: string; warning?: string; identifierIssues?: number };
type Fixture = { name: string; data: Buffer; expectations: Expected[] };
const files: Fixture[] = buildTestDatasets();
const cases = files.flatMap((file) => file.expectations.map((expected) => ({ ...file, expected, label: `${file.name}${expected.sheet ? ` / ${expected.sheet}` : ''}` })));

function bufferOf(data: Buffer): ArrayBuffer {
  return Uint8Array.from(data).buffer;
}

describe('synthetic manual test pack', () => {
  it.each(cases)('$label matches its documented import result', ({ name, data, expected }) => {
    const run = () => name.endsWith('.csv') ? parseCsv(data.toString('utf8'))
      : expected.sheet ? parseWorkbook(bufferOf(data), expected.sheet) : listSheets(bufferOf(data));
    if (expected.error) {
      expect(run).toThrow(expected.error);
      return;
    }
    const dataset = run() as ReturnType<typeof parseCsv>;
    expect(dataset.records).toHaveLength(expected.rows!);
    expect(dataset.columns).toHaveLength(expected.columns!);
    if (expected.warning) expect(dataset.warnings.join(' ')).toContain(expected.warning);
    if (expected.identifierIssues !== undefined) expect(validateIdentifiers(dataset, 'asset_id')).toHaveLength(expected.identifierIssues);
  });

  it('provides exact byte boundaries and preserves quoted/unicode values', () => {
    const get = (name: string) => files.find((file) => file.name === name)!;
    expect(get('boundary-10MiB.csv').data.byteLength).toBe(10 * 1024 * 1024);
    expect(get('reject-10MiB-plus-one-byte.csv').data.byteLength).toBe(10 * 1024 * 1024 + 1);
    const unicode = parseCsv(get('unicode-and-leading-zeroes.csv').data.toString('utf8'));
    expect(unicode.records[0].values.asset_id).toBe('000001');
    expect(unicode.records[1].values.name).toBe('温度传感器');
    const quoted = parseCsv(get('quoted-fields-and-line-breaks.csv').data.toString('utf8'));
    expect(quoted.records[0].values.name).toBe('Valve, north');
    expect(quoted.records[1].values.notes).toBe('First line\r\nSecond line');
  });

  it('includes unique and identical-label workloads and cached formula behavior', () => {
    const unique = parseCsv(files.find((file) => file.name === 'assets-20000-unique.csv')!.data.toString('utf8'));
    expect(new Set(unique.records.map((record) => record.values.asset_id)).size).toBe(20_000);
    const repeated = parseCsv(files.find((file) => file.name === 'assets-20000-repeated-labels.csv')!.data.toString('utf8'));
    expect(new Set(repeated.records.map((record) => JSON.stringify(record.values))).size).toBe(1);
    const multi = files.find((file) => file.name === 'workbook-multiple-sheets.xlsx')!;
    const formula = parseWorkbook(bufferOf(multi.data), 'Stored formula values');
    expect(formula.records[0].values.calculated).toBe('42');
    expect(formula.records[0].values.no_cached_value).toBe('');
  });
});
