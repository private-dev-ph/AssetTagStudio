import { decodePixels } from './decode';
import { workerFilePixels } from './image';
self.onmessage = async (event: MessageEvent<{ file?: Blob; pixels: ArrayBuffer; width: number; height: number }>) => {
  let image: Pick<ImageData, 'data' | 'width' | 'height'>;
  try {
    image = event.data.file ? await workerFilePixels(event.data.file) : { data: new Uint8ClampedArray(event.data.pixels), width: event.data.width, height: event.data.height };
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : 'Could not prepare this image for inspection.' });
    return;
  }
  try { self.postMessage({ result: decodePixels(image.data, image.width, image.height) }); }
  catch { self.postMessage({ error: 'No readable QR or Code 128 found. Use a sharper, upright image with the full code and its white border visible.' }); }
};
