import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../types';
import { applyIdsToColumn, previewIds, type IdGeneratorOptions } from './logic';

const dataset: Dataset = { columns: ['Asset ID', 'Type'], warnings: [], records: [
  { id: 'r1', values: { 'Asset ID': '', Type: 'PC' } }, { id: 'r2', values: { 'Asset ID': 'KEEP', Type: 'PC' } }, { id: 'r3', values: { 'Asset ID': 'PC-002', Type: 'PC' } },
] };
const options: IdGeneratorOptions = { column: 'Asset ID', pattern: '{Type}-{sequence}', prefix: '', suffix: '', start: 1, padding: 3, year: '2026', date: '2026-10-04', selectedIds: new Set(['r1']), blankOnly: true, overwrite: false };

describe('ID generator', () => {
  it('previews source tokens and only targets selected blank rows', () => {
    expect(previewIds(dataset, options)).toEqual([{ rowId: 'r1', before: '', after: 'PC-001', status: 'ready', message: undefined }]);
  });
  it('flags collision with a nonselected row and preserves source immutability', () => {
    const preview = previewIds(dataset, { ...options, pattern: 'KEEP' });
    expect(preview[0]?.status).toBe('collision');
    expect(() => applyIdsToColumn(dataset, 'Asset ID', preview)).toThrow(/collisions/);
    expect(dataset.records[0]?.values['Asset ID']).toBe('');
  });
  it('requires explicit overwrite and keeps internal identities and unselected values', () => {
    const preview = previewIds(dataset, { ...options, selectedIds: new Set(['r2']), blankOnly: false, overwrite: true, pattern: 'NEW-{year}-{sequence}' });
    const changed = applyIdsToColumn(dataset, 'Asset ID', preview);
    expect(changed.records.map(row => row.id)).toEqual(['r1', 'r2', 'r3']);
    expect(changed.records[1]?.values['Asset ID']).toBe('NEW-2026-001');
    expect(dataset.records[1]?.values['Asset ID']).toBe('KEEP');
  });
  it('rejects missing interpolation columns and unsafe empty token shapes', () => {
    expect(() => previewIds(dataset, { ...options, pattern: '{missing}' })).toThrow(/not a dataset column/);
    expect(() => previewIds(dataset, { ...options, pattern: '{}' })).toThrow(/Use tokens/);
  });
});
