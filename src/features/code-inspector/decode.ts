import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library';
import { MAX_IMAGE_PIXELS } from './limits';
export type DecodedCode = { text: string; format: 'QR_CODE' | 'CODE_128' };
export function decodePixels(rgba: Uint8ClampedArray, width: number, height: number): DecodedCode {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_IMAGE_PIXELS || rgba.length !== width * height * 4) throw new Error('Image dimensions or pixel data are invalid. Use an image up to 8 megapixels.');
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0; i < luminance.length; i += 1) {
    const offset = i * 4; const alpha = rgba[offset + 3] / 255;
    luminance[i] = Math.round(((rgba[offset] + rgba[offset + 1] * 2 + rgba[offset + 2]) / 4) * alpha + 255 * (1 - alpha));
  }
  const reader = new MultiFormatReader();
  try {
    const result = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height))), new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]], [DecodeHintType.TRY_HARDER, true],
    ]));
    const text = result.getText();
    if (!text || text.length > 2000) throw new Error('Decoded content is empty or exceeds 2,000 characters.');
    return { text, format: result.getBarcodeFormat() === BarcodeFormat.QR_CODE ? 'QR_CODE' : 'CODE_128' };
  } finally { reader.reset(); }
}
