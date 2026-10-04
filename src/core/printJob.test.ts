import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE, DEFAULT_TEMPLATE, type AssetRecord } from '../types';
import { createPrintJob } from './printJob';
import { manifestFromPrintJob } from '../features/manifest/manifest';

describe('immutable print jobs', () => {
  it('snapshots records, signed calibrated positions, and multipage manifest order', () => {
    const records: AssetRecord[] = Array.from({ length: 22 }, (_, index) => ({ id: `row-${index}`, values: { ID: `A-${index}` } }));
    const template = { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'ID' } };
    const page = { ...DEFAULT_PAGE, widthMm: 123, heightMm: 66, marginLeftMm: 1, marginRightMm: 1, marginTopMm: 1, marginBottomMm: 1, gapXMm: 0, gapYMm: 0, offsetXMm: 0.5, offsetYMm: -0.25 };
    const job = createPrintJob(records, template, page, { idField: 'ID', generatedAt: '2026-10-04T00:00:00.000Z' });
    records[0]!.values.ID = 'edited after export';
    expect(job.records[0]!.values.ID).toBe('A-0');
    expect(Object.isFrozen(job.labels[0]!.position)).toBe(true);
    const manifest = manifestFromPrintJob(job);
    expect(job.labels.length).toBe(22);
    expect(manifest.records.map(row => [row.labelIndex, row.page, row.row, row.column, row.xMm, row.yMm])).toEqual(job.labels.map(label => [label.labelIndex, label.page, label.row, label.column, label.position.xMm, label.position.yMm]));
    expect(manifest.calibration).toEqual({ offsetXMm: 0.5, offsetYMm: -0.25 });
  });
  it('does not publish a partial job for invalid payloads or clipping', () => {
    const badPayload: AssetRecord[] = [{ id: 'one', values: { ID: '' } }];
    const template = { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'ID' } };
    expect(() => createPrintJob(badPayload, template, DEFAULT_PAGE)).toThrow(/no value/);
    expect(() => createPrintJob([{ id: 'one', values: { ID: 'A' } }], template, { ...DEFAULT_PAGE, widthMm: 60, marginLeftMm: 0, marginRightMm: 0, offsetXMm: 1 })).toThrow(/off the page/);
  });
  it('rejects oversized input before validating or resolving each payload', () => {
    const tooMany = Array.from({ length: 20_001 }, (_, i) => ({ id: `r-${i}`, values: {} }));
    expect(() => createPrintJob(tooMany, DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/supports up to 20,000 records/);
    expect(() => createPrintJob([{ id: 'same', values: {} }, { id: 'same', values: {} }], DEFAULT_TEMPLATE, DEFAULT_PAGE)).toThrow(/identities must be unique/);
  });
});
