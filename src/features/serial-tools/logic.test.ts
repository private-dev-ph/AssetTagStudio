import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dataset } from '../../types';
import { applySerialPreview, previewSerials, testSerialPattern } from './logic';

const dataset: Dataset = { columns: ['Serial'], warnings: [], records: [
  { id: 'a', values: { Serial: ' sn: czc-91237 ' } }, { id: 'b', values: { Serial: 'CZC91237' } }, { id: 'c', values: { Serial: 'CC10042' } },
] };
const selectedIds = new Set(['a', 'b']);

describe('serial tools', () => {
  it('normalizes with preview, detects duplicates, and applies only on request', async () => {
    const preview = await previewSerials(dataset, { column: 'Serial', selectedIds, mode: 'normalize', casing: 'upper', stripPrefix: 'SN:', removeSeparators: true, minLength: 1, maxLength: 30, knownPrefixes: 'CZC', pattern: '' });
    expect(preview.map(row => row.after)).toEqual(['CZC91237', 'CZC91237']);
    expect(preview[1]?.status).toBe('duplicate');
    const changed = applySerialPreview(dataset, 'Serial', preview);
    expect(changed.records[0]?.values.Serial).toBe('CZC91237');
    expect(dataset.records[0]?.values.Serial).toContain(' sn:');
  });
  it('deduplicates deterministically and keeps the first dataset row', async () => {
    const preview = await previewSerials(dataset, { column: 'Serial', selectedIds: new Set(['a', 'b', 'c']), mode: 'deduplicate', casing: 'upper', stripPrefix: 'SN:', removeSeparators: true, minLength: 1, maxLength: 30, knownPrefixes: '', pattern: '' });
    const changed = applySerialPreview(dataset, 'Serial', preview, true);
    expect(changed.records.map(row => row.id)).toEqual(['a', 'c']);
  });
  it('validates extracted values on a bounded checker and rejects risky patterns', async () => {
    const preview = await previewSerials(dataset, { column: 'Serial', selectedIds: new Set(['a']), mode: 'extract', casing: 'upper', stripPrefix: '', removeSeparators: true, minLength: 1, maxLength: 30, knownPrefixes: 'CZC', pattern: '^(CZC|CC)[A-Z0-9]+$' }, async (_pattern, values) => values.map(() => true));
    expect(preview[0]?.after).toBe('CZC91237');
    await expect(previewSerials(dataset, { column: 'Serial', selectedIds, mode: 'validate', casing: 'preserve', stripPrefix: '', removeSeparators: false, minLength: 1, maxLength: 30, knownPrefixes: '', pattern: '(a+)+$' })).rejects.toThrow(/too long/);
  });
  it('rejects invalid length rules before work', async () => {
    await expect(previewSerials(dataset, { column: 'Serial', selectedIds, mode: 'validate', casing: 'preserve', stripPrefix: '', removeSeparators: false, minLength: 40, maxLength: 2, knownPrefixes: '', pattern: '' })).rejects.toThrow(/Length rules/);
  });
});

describe('serial pattern worker', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('terminates a worker that exceeds its time limit', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    class StalledWorker { onmessage: ((event: MessageEvent) => void) | null = null; onerror: (() => void) | null = null; postMessage() {} terminate = terminate; }
    vi.stubGlobal('Worker', StalledWorker);
    const result = testSerialPattern('^A+$', ['AAAA']);
    const rejected = expect(result).rejects.toThrow(/time limit/);
    await vi.advanceTimersByTimeAsync(101);
    await rejected;
    expect(terminate).toHaveBeenCalledOnce();
  });
});
