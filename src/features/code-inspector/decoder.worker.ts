import { decodePixels } from './decode';
self.onmessage = (event: MessageEvent<{ pixels: ArrayBuffer; width: number; height: number }>) => {
  try { self.postMessage({ result: decodePixels(new Uint8ClampedArray(event.data.pixels), event.data.width, event.data.height) }); }
  catch { self.postMessage({ error: 'No readable QR or Code 128 found. Use a sharper, upright image with the full code and its white border visible.' }); }
};
