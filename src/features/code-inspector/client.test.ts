import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeImageData, decodeImageFile } from './client';
import { MAX_IMAGE_BYTES } from './image';
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
  it('keeps file preprocessing inside the timed and cancellable worker', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', DecoderWorker);
    const file = new Blob(['image']);
    const read = vi.spyOn(file, 'arrayBuffer');
    const controller = new AbortController();
    const pending = decodeImageFile(file, controller.signal, 100);
    expect(DecoderWorker.current.postMessage).toHaveBeenCalledWith({ file }, []);
    expect(read).not.toHaveBeenCalled();
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(DecoderWorker.current.terminate).toHaveBeenCalledOnce();
    const stalled = decodeImageFile(file, new AbortController().signal, 100);
    const assertion = expect(stalled).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(101); await assertion;
    expect(DecoderWorker.current.terminate).toHaveBeenCalledOnce();
  });
  it('rejects oversized or already cancelled files without starting a worker', async () => {
    const constructor = vi.fn(); vi.stubGlobal('Worker', constructor);
    await expect(decodeImageFile({ size: MAX_IMAGE_BYTES + 1 } as Blob, new AbortController().signal)).rejects.toThrow(/10 MiB/);
    const controller = new AbortController(); controller.abort();
    await expect(decodeImageFile(new Blob(['image']), controller.signal)).rejects.toThrow(/cancelled/);
    expect(constructor).not.toHaveBeenCalled();
  });

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
