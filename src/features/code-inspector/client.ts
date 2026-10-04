import type { DecodedCode } from './decode';
export function decodeImageData(image: ImageData, signal: AbortSignal, timeoutMs = 5000): Promise<DecodedCode> {
  if (signal.aborted) return Promise.reject(new Error('Inspection cancelled.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./decoder.worker.ts', import.meta.url), { type: 'module' });
    let done = false;
    const finish = (error?: Error, result?: DecodedCode) => {
      if (done) return; done = true; clearTimeout(timeout); worker.terminate(); signal.removeEventListener('abort', aborted);
      if (error) reject(error); else resolve(result!);
    };
    const aborted = () => finish(new Error('Inspection cancelled.'));
    const timeout = setTimeout(() => finish(new Error('Code inspection timed out. Crop the image around one code and retry.')), timeoutMs);
    signal.addEventListener('abort', aborted, { once: true });
    worker.onerror = () => finish(new Error('The local decoder could not start. Reload this page and retry.'));
    worker.onmessage = (event: MessageEvent<{ result?: DecodedCode; error?: string }>) => {
      if (event.data.error) finish(new Error(event.data.error));
      else if (event.data.result && typeof event.data.result.text === 'string' && ['QR_CODE', 'CODE_128'].includes(event.data.result.format)) finish(undefined, event.data.result);
      else finish(new Error('The decoder returned an invalid result.'));
    };
    try { const pixels = image.data.slice().buffer; worker.postMessage({ pixels, width: image.width, height: image.height }, [pixels]); }
    catch { finish(new Error('This image could not be sent to the local decoder.')); }
  });
}
