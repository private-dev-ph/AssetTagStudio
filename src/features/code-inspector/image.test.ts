import { describe, expect, it } from 'vitest';
import { imageDimensions, previewBlob } from './image';
describe('image preflight resource bounds', () => {
  it('rejects unsupported/malformed images before browser image decoding', () => {
    expect(() => imageDimensions(new TextEncoder().encode('<svg></svg>'))).toThrow(/PNG or JPEG/);
    expect(() => imageDimensions(new Uint8Array([255, 216, 255, 192, 0, 1]))).toThrow();
    expect(() => previewBlob('https://example.invalid/image.png')).toThrow(/preview/);
  });
  it('checks PNG dimensions and pixel limits before allocating a bitmap', () => {
    const bytes = new Uint8Array(24); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer); view.setUint32(16, 200); view.setUint32(20, 100);
    expect(imageDimensions(bytes)).toEqual({ width: 200, height: 100 });
    view.setUint32(16, 8000); view.setUint32(20, 8000); expect(() => imageDimensions(bytes)).toThrow(/8 megapixels/);
  });
});
