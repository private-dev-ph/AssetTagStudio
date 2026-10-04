import { MAX_IMAGE_PIXELS } from './limits';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0; let height = 0;
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    let at = 2;
    while (at + 4 < bytes.length) {
      if (bytes[at++] !== 255) break;
      while (bytes[at] === 255 && at < bytes.length) at += 1;
      const marker = bytes[at++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (at + 2 > bytes.length) break;
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) { height = view.getUint16(at + 3); width = view.getUint16(at + 5); break; }
      at += length;
    }
  }
  if (!width || !height) throw new Error('Use a valid PNG or JPEG image. SVG and other formats are not supported.');
  if (width * height > MAX_IMAGE_PIXELS || width > 16000 || height > 16000) throw new Error('Image exceeds 8 megapixels. Crop or resize it before inspecting.');
  return { width, height };
}
// Called only inside the terminable decoder worker. Its client deadline covers
// file reads, native bitmap decoding, canvas allocation/readback and decoding.
export async function workerFilePixels(file: Blob): Promise<ImageData> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 10 MiB or smaller.');
  imageDimensions(new Uint8Array(await file.arrayBuffer()));
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('Could not read this PNG or JPEG. Use a valid image and retry.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error('Image exceeds 8 megapixels. Crop or resize it before inspecting.');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser does not support local worker image inspection.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally { bitmap.close(); }
}
export function sourcePixels(source: CanvasImageSource, width: number, height: number): ImageData {
  if (!width || !height || width * height > MAX_IMAGE_PIXELS) throw new Error('Image dimensions are unsupported.');
  const scale = Math.min(1, 2048 / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser does not support local image inspection.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
export function previewBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > 16 * 1024 * 1024) throw new Error('Generate a PNG label preview first.');
  const bytes = Uint8Array.from(atob(dataUrl.slice('data:image/png;base64,'.length)), character => character.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}
