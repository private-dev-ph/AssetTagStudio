import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../types';
import { auditDataset, previewHealthFix } from './logic';

const dataset: Dataset = { columns: ['Asset  ID', 'Serial', 'Name', 'Empty'], warnings: [], importAudit: { sourceHeaders: [' Asset  ID ', 'Serial', 'Name', 'Empty'], removedEmptyRows: 2 }, records: [
  { id: 'r1', values: { 'Asset  ID': ' A-1 ', Serial: 'S1', Name: 'Pump', Empty: '' } },
  { id: 'r2', values: { 'Asset  ID': 'A-1', Serial: 'S1', Name: '', Empty: '' } },
] };

describe('data health', () => {
  it('returns structured bounded duplicate, blank, empty, whitespace and header findings', () => {
    const findings = auditDataset(dataset, 'Asset  ID', 'Serial', 'Name');
    expect(findings.some(item => item.code === 'duplicate-id' && item.rowIds?.join(',') === 'r1,r2')).toBe(true);
    expect(findings.some(item => item.code === 'duplicate-serial')).toBe(true);
    expect(findings.some(item => item.code === 'blank-name' && item.rowIds?.[0] === 'r2')).toBe(true);
    expect(findings.some(item => item.code === 'empty-column' && item.column === 'Empty')).toBe(true);
    expect(findings.some(item => item.code === 'empty-rows')).toBe(true);
    expect(findings.some(item => item.code === 'header-whitespace')).toBe(true);
    expect(findings.length).toBeLessThanOrEqual(100);
  });
  it('previews trim and header fixes immutably and emits a column map', () => {
    const trim = previewHealthFix(dataset, 'trim');
    expect(trim.dataset.records[0]?.values['Asset  ID']).toBe('A-1');
    expect(dataset.records[0]?.values['Asset  ID']).toBe(' A-1 ');
    const headers = previewHealthFix(dataset, 'headers');
    expect(headers.dataset.columns[0]).toBe('Asset ID');
    expect(headers.columnMap?.['Asset  ID']).toBe('Asset ID');
  });
  it('blocks fixes that would remove every column or create duplicate names', () => {
    expect(() => previewHealthFix({ ...dataset, records: dataset.records.map(row => ({ ...row, values: { 'Asset ID': '', Serial: '', Name: '', Empty: '' } })) }, 'empty-columns')).toThrow(/At least one column/);
    expect(() => previewHealthFix({ ...dataset, columns: [' a ', 'a'], records: dataset.records.map(row => ({ ...row, values: { ...row.values, ' a ': '', a: '' } })) }, 'headers')).toThrow(/duplicate names/);
  });
});
