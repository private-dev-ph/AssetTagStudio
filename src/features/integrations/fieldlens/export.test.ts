import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE, DEFAULT_TEMPLATE, type Dataset } from '../../../types';
import { fieldLensCsv, prepareFieldLensJob, type FieldLensMapping } from './export';

const dataset: Dataset = { columns: ['ID', 'Name', 'Kind', 'Serial', 'Location'], warnings: [], records: [
  { id: 'row-a', values: { ID: 'PC-001', Name: 'Laptop', Kind: 'Computer', Serial: 'S-1', Location: 'Room 1' } },
    { id: 'row-b', values: { ID: '=SUM(A1:A2)', Name: 'Desktop', Kind: 'Computer', Serial: '', Location: '' } },
] };
const mapping: FieldLensMapping = { idField: 'ID', nameField: 'Name', assetTypeField: 'Kind', serialField: 'Serial', locationField: 'Location' };

describe('FieldLens print package', () => {
  it('uses one frozen record snapshot for QR payload IDs and CSV asset_id values', () => {
    const job = prepareFieldLensJob(dataset, new Set(['row-a']), mapping, DEFAULT_TEMPLATE, DEFAULT_PAGE);
    expect(Object.isFrozen(job)).toBe(true);
    expect(Object.isFrozen(job.records[0]!.values)).toBe(true);
    expect(job.labels[0]!.payload).toBe('fieldlens://asset/PC-001');
    expect(fieldLensCsv(job, mapping)).toContain('"PC-001","Laptop","Computer","S-1","Room 1"');
    expect(() => { job.records[0]!.values.ID = 'changed'; }).toThrow();
  });
  it('rejects duplicates, missing mappings, formula-leading IDs, and incompatible URI values', () => {
    expect(() => prepareFieldLensJob(dataset, new Set(), mapping, DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/Select at least one/);
    expect(() => prepareFieldLensJob(dataset, new Set(['not-current']), mapping, DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/no longer in the current dataset/);
    expect(() => prepareFieldLensJob({ ...dataset, records: [dataset.records[0]!, { ...dataset.records[0]!, id: 'row-c' }] }, new Set(['row-a', 'row-c']), mapping, DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/appears more than once/);
    expect(() => prepareFieldLensJob(dataset, new Set(['row-a']), { ...mapping, nameField: '' }, DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/Map a valid name/);
    expect(() => prepareFieldLensJob(dataset, new Set(['row-b']), mapping, DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/formula character/);
    const badId = { ...dataset, records: [{ ...dataset.records[0]!, values: { ...dataset.records[0]!.values, ID: 'A/B' } }] };
    expect(() => prepareFieldLensJob(badId, new Set(['row-a']), mapping, DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/unescaped identifier/);
  });
});
