import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE, DEFAULT_TEMPLATE, type Dataset } from '../types';
import { checkTemplateMapping, transformedWorkspace, viewFromHash } from './workspace';
const dataset: Dataset = { columns: ['Old', 'Name'], records: [{ id: 'r1', values: { Old: 'A', Name: 'Desk' } }, { id: 'r2', values: { Old: 'B', Name: 'Chair' } }], warnings: [] };
describe('shared workspace transactions', () => {
  it('recognizes subpages and safely falls back for unknown hashes', () => {
    expect(viewFromHash('#/serial-tools')).toBe('serial-tools');
    expect(viewFromHash('#top')).toBe('asset-labels');
    expect(viewFromHash('#constructor')).toBe('asset-labels');
  });
  it('remaps hidden columns, identifier, payload and printed fields in one transaction', () => {
    const current = { dataset, template: { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'Old', payload: 'asset:{Old}' }, fields: [{ source: 'Old', label: 'Old', fontSize: 8, bold: false }, { source: 'Name', label: 'Custom', fontSize: 8, bold: false }] }, page: DEFAULT_PAGE, idField: 'Old', selected: new Set(['r1', 'r2']), hiddenFields: new Set(['Old']) };
    const next: Dataset = { ...dataset, columns: ['ID', 'Name'], records: [{ id: 'r1', values: { ID: 'A', Name: 'Desk' } }] };
    const result = transformedWorkspace(current, next, { Old: 'ID' });
    expect(result.idField).toBe('ID'); expect(result.template.code.payload).toBe('asset:{ID}');
    expect(result.template.fields[0]).toMatchObject({ source: 'ID', label: 'ID' });
    expect(result.template.fields[1].label).toBe('Custom'); expect([...result.selected]).toEqual(['r1']);
    expect([...result.hiddenFields]).toEqual(['ID']); expect(current.idField).toBe('Old');
    expect(() => transformedWorkspace(current, next, { Old: 'Missing' })).toThrow(/mappings/);
  });
  it('rejects missing template references without erasing them', () => {
    expect(() => checkTemplateMapping({ ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'Missing' } }, dataset)).toThrow(/missing columns/);
    checkTemplateMapping({ ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, type: 'none' } }, dataset);
  });
});
