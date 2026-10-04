import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dataset } from '../../types';
import { inspectFile, readSheet } from './client';

const result: Dataset = { columns: ['id'], records: [{ id: '1', values: Object.assign(Object.create(null), { id: 'a' }) }], warnings: [] };

type Behavior = 'respond' | 'error' | 'messageerror' | 'post-fail' | 'timeout' | 'start-fail';
let behavior: Behavior = 'respond';
let workers: FakeWorker[] = [];

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  terminated = false;

  constructor() {
    if (behavior === 'start-fail') throw new Error('worker startup blocked');
    workers.push(this);
  }

  postMessage(payload: unknown): void {
    if (behavior === 'post-fail') throw new Error('structured clone failed');
    const id = (payload as { id: number }).id;
    if (behavior === 'respond') this.onmessage?.({ data: { id, ok: true, value: result } } as MessageEvent);
    if (behavior === 'error') this.onerror?.({ message: 'worker failed' } as ErrorEvent);
    if (behavior === 'messageerror') this.onmessageerror?.({} as MessageEvent);
  }

  terminate(): void { this.terminated = true; }
}

function useFakeWorker(next: Behavior): void {
  behavior = next;
  workers = [];
  vi.stubGlobal('Worker', FakeWorker);
}

function csvFile(): File {
  return new File(['id\na'], 'items.csv', { type: 'text/csv' });
}

function excelFile(): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'items.xlsx');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('worker client lifecycle', () => {
  it('terminates the worker after a successful parse', async () => {
    useFakeWorker('respond');
    await expect(inspectFile(csvFile())).resolves.toEqual({ kind: 'csv', dataset: result });
    expect(workers).toHaveLength(1);
    expect(workers[0].terminated).toBe(true);
  });

  it('reports worker startup, runtime, and message decoding failures', async () => {
    useFakeWorker('start-fail');
    await expect(inspectFile(csvFile())).rejects.toThrow(/could not be started/);

    useFakeWorker('error');
    await expect(inspectFile(csvFile())).rejects.toThrow(/worker failed/);
    expect(workers[0].terminated).toBe(true);

    useFakeWorker('messageerror');
    await expect(inspectFile(csvFile())).rejects.toThrow(/unreadable result/);
    expect(workers[0].terminated).toBe(true);
  });

  it('handles postMessage failures and terminates the worker', async () => {
    useFakeWorker('post-fail');
    await expect(inspectFile(csvFile())).rejects.toThrow(/sent to the import worker/);
    expect(workers[0].terminated).toBe(true);
  });

  it('stops a worker that exceeds the 20 second deadline', async () => {
    useFakeWorker('timeout');
    vi.useFakeTimers();
    const pending = readSheet(excelFile(), 'Assets');
    await vi.waitFor(() => expect(workers).toHaveLength(1));
    const rejected = expect(pending).rejects.toThrow(/took too long/);
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(workers[0].terminated).toBe(true);
  });

  it('immediately terminates and rejects an older worker when a new import starts', async () => {
    useFakeWorker('timeout');
    const firstImport = inspectFile(csvFile());
    await vi.waitFor(() => expect(workers).toHaveLength(1));
    const firstRejected = expect(firstImport).rejects.toThrow(/cancelled because a newer import started/);

    behavior = 'respond';
    const secondImport = inspectFile(csvFile());
    expect(workers[0].terminated).toBe(true);
    await expect(secondImport).resolves.toEqual({ kind: 'csv', dataset: result });
    await firstRejected;
    expect(workers).toHaveLength(2);
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });
});
