import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeImageData } from './client';
class DecoderWorker {
  static current: DecoderWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor() { DecoderWorker.current = this; }
}
const image = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('bounded decoder lifecycle', () => {
  it('terminates on completion and returns only valid results', async () => {
    vi.stubGlobal('Worker', DecoderWorker);
    const result = decodeImageData(image, new AbortController().signal);
    DecoderWorker.current.onmessage!({ data: { result: { text: 'A-1', format: 'QR_CODE' } } });
    await expect(result).resolves.toEqual({ text: 'A-1', format: 'QR_CODE' });
    expect(DecoderWorker.current.terminate).toHaveBeenCalledOnce();
  });
  it('terminates stalled workers on timeout and cancelled operations on abort', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', DecoderWorker);
    const timeout = decodeImageData(image, new AbortController().signal, 100);
    const timeoutAssertion = expect(timeout).rejects.toThrow(/timed out/); await vi.advanceTimersByTimeAsync(101); await timeoutAssertion;
    expect(DecoderWorker.current.terminate).toHaveBeenCalledOnce();
    const controller = new AbortController(); const cancelled = decodeImageData(image, controller.signal); controller.abort();
    await expect(cancelled).rejects.toThrow(/cancelled/); expect(DecoderWorker.current.terminate).toHaveBeenCalledOnce();
  });
  it('cleans up worker errors and rejects malformed results', async () => {
    vi.stubGlobal('Worker', DecoderWorker);
    const error = decodeImageData(image, new AbortController().signal); DecoderWorker.current.onerror!();
    await expect(error).rejects.toThrow(/decoder could not start/);
    const malformed = decodeImageData(image, new AbortController().signal); DecoderWorker.current.onmessage!({ data: {} });
    await expect(malformed).rejects.toThrow(/invalid result/); expect(DecoderWorker.current.terminate).toHaveBeenCalledOnce();
  });
});
