import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dataset } from '../../types';
import { applySerialPreview, PreviewGeneration, previewSerials, testSerialPattern } from './logic';

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
    class StalledWorker { static current: StalledWorker; constructor() { StalledWorker.current = this; } onmessage: ((event: MessageEvent) => void) | null = null; onerror: (() => void) | null = null; postMessage() {} terminate = terminate; }
    vi.stubGlobal('Worker', StalledWorker);
    const result = testSerialPattern('^A+$', ['AAAA']);
    const rejected = expect(result).rejects.toThrow(/time limit/);
    StalledWorker.current.onmessage!({ data: { ready: true } } as MessageEvent);
    await vi.advanceTimersByTimeAsync(101);
    await rejected;
    expect(terminate).toHaveBeenCalledOnce();
  });
  it('allows bounded slow startup without spending the execution budget', async () => {
    vi.useFakeTimers();
    class ReadyWorker {
      static current: ReadyWorker;
      constructor() { ReadyWorker.current = this; }
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = vi.fn();
      postMessage = vi.fn((request: { id: number }) => this.onmessage!({ data: { id: request.id, ok: true, matches: [true] } } as MessageEvent));
    }
    vi.stubGlobal('Worker', ReadyWorker);
    const result = testSerialPattern('^A+$', ['AAAA']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ReadyWorker.current.postMessage).not.toHaveBeenCalled();
    ReadyWorker.current.onmessage!({ data: { ready: true } } as MessageEvent);
    await expect(result).resolves.toEqual([true]);
    expect(ReadyWorker.current.terminate).toHaveBeenCalledOnce();
  });
  it('terminates workers that never finish starting', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    class NeverReadyWorker { static current: NeverReadyWorker; constructor() { NeverReadyWorker.current = this; } onmessage: ((event: MessageEvent) => void) | null = null; onerror = null; postMessage() {} terminate = terminate; }
    vi.stubGlobal('Worker', NeverReadyWorker);
    const result = testSerialPattern('^A+$', ['AAAA']);
    const rejected = expect(result).rejects.toThrow(/startup/);
    await vi.advanceTimersByTimeAsync(5001); await rejected;
    expect(terminate).toHaveBeenCalledOnce();
    NeverReadyWorker.current.onmessage!({ data: { ready: true } } as MessageEvent);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('serial preview request generation', () => {
  it('invalidates results after settings or selection changes', () => {
    const requests = new PreviewGeneration();
    const stale = requests.begin();
    requests.invalidate();
    expect(requests.isCurrent(stale)).toBe(false);
    const current = requests.begin();
    expect(requests.isCurrent(current)).toBe(true);
  });
});
