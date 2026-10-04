import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../types';
import { applyIdsToColumn, previewIds } from '../../features/id-generator/logic';
import { applySerialPreview } from '../../features/serial-tools/logic';
import { selectBoundedRows } from './boundedSelection';

const records = Array.from({ length: 20_000 }, (_, index) => ({ id: `r${index + 1}`, values: { ID: '' } }));
const dataset: Dataset = { columns: ['ID'], warnings: [], records };

describe('bounded preview selection', () => {
  it('limits a 20,000 row selection to the default-sized batch', () => {
    const result = selectBoundedRows(dataset, new Set(records.map(row => row.id)), 1, 2_000, 2_000);
    expect(result.selectedCount).toBe(20_000);
    expect(result.selectedIds.size).toBe(2_000);
    expect(result.selectedIds.has('r2000')).toBe(true);
    expect(result.selectedIds.has('r2001')).toBe(false);
  });

  it('keeps noncontiguous selections in stable dataset order', () => {
    const result = selectBoundedRows(dataset, new Set(['r15', 'r2', 'r9', 'missing']), 2, 2, 5);
    expect([...result.selectedIds]).toEqual(['r9', 'r15']);
  });

  it('applies only rows included in the chosen preview batch', () => {
    const selected = new Set(['r1', 'r2', 'r3', 'r4']);
    const batch = selectBoundedRows(dataset, selected, 2, 2, 2);
    const preview = previewIds(dataset, { column: 'ID', pattern: 'ID-{sequence}', prefix: '', suffix: '', start: 1, padding: 3, year: '2026', date: '2026-10-05', selectedIds: batch.selectedIds, blankOnly: true, overwrite: false });
    const changed = applyIdsToColumn(dataset, 'ID', preview);
    expect(preview.map(row => row.rowId)).toEqual(['r2', 'r3']);
    expect(changed.records.slice(0, 4).map(row => row.values.ID)).toEqual(['', 'ID-001', 'ID-002', '']);
    const serialChanged = applySerialPreview(dataset, 'ID', batch.selectedIds.size === 2 ? [
      { rowId: 'r2', before: '', after: 'SERIAL-2', status: 'ready' },
      { rowId: 'r3', before: '', after: 'SERIAL-3', status: 'ready' },
    ] : []);
    expect(serialChanged.records.slice(0, 4).map(row => row.values.ID)).toEqual(['', 'SERIAL-2', 'SERIAL-3', '']);
    expect(selected.size).toBe(4);
  });

  it('rejects fractional, out-of-range, and oversized bounds', () => {
    const selected = new Set(['r1', 'r2']);
    expect(() => selectBoundedRows(dataset, selected, 1.2, 1, 2)).toThrow(/Start position/);
    expect(() => selectBoundedRows(dataset, selected, 3, 1, 2)).toThrow(/Start position/);
    expect(() => selectBoundedRows(dataset, selected, 2, 2, 2)).toThrow(/Preview count/);
    expect(() => selectBoundedRows(dataset, selected, 1, 2_001, 2_000)).toThrow(/Preview count/);
    expect(() => selectBoundedRows(dataset, selected, 1, 1.5, 2)).toThrow(/Preview count/);
    expect(() => selectBoundedRows(dataset, selected, 1, Number.NaN, 2)).toThrow(/Preview count/);
    expect(() => selectBoundedRows(dataset, selected, 1, Number.POSITIVE_INFINITY, 2)).toThrow(/Preview count/);
    expect(() => selectBoundedRows(dataset, selected, 1, 0, 2)).toThrow(/Preview count/);
  });

  it('rejects empty selection and invalid limits', () => {
    expect(() => selectBoundedRows(dataset, new Set(), 1, 1, 2)).toThrow(/Select at least one/);
    expect(() => selectBoundedRows(dataset, new Set(['r1']), 1, 1, 0)).toThrow(/Preview limit/);
  });
});
