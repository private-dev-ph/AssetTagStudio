import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { decodePixels } from './decode';
import { analyzeContent } from './analyze';
import { DEFAULT_TEMPLATE } from '../../types';
describe('local code inspector', () => {
  it('decodes QR content from actual generated pixels', () => {
    const qr = QRCode.create('AST-QR-0042', { errorCorrectionLevel: 'M' }); const side = (qr.modules.size + 8) * 5;
    const rgba = new Uint8ClampedArray(side * side * 4).fill(255);
    for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) {
      const moduleX = Math.floor(x / 5) - 4; const moduleY = Math.floor(y / 5) - 4;
      if (moduleX >= 0 && moduleY >= 0 && moduleX < qr.modules.size && moduleY < qr.modules.size && qr.modules.get(moduleY, moduleX)) { const at = (y * side + x) * 4; rgba[at] = rgba[at + 1] = rgba[at + 2] = 0; }
    }
    expect(decodePixels(rgba, side, side)).toEqual({ text: 'AST-QR-0042', format: 'QR_CODE' });
  });
  it('rejects invalid pixel buffers and images without codes', () => {
    expect(() => decodePixels(new Uint8ClampedArray(4), 9_000_000, 1)).toThrow(/megapixels/);
    expect(() => decodePixels(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100)).toThrow();
  });
  it('decodes real Code 128 bars produced by the existing encoder', () => {
    const encoded = {} as { encodings: { data: string }[] };
    JsBarcode(encoded, 'AST-128-0042', { format: 'CODE128', displayValue: false });
    const bars = encoded.encodings.map(encoding => encoding.data).join('');
    const width = (bars.length + 40) * 3; const height = 100;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 10; y < height - 10; y += 1) for (let x = 0; x < width; x += 1) {
      if (bars[Math.floor(x / 3) - 20] === '1') { const at = (y * width + x) * 4; rgba[at] = rgba[at + 1] = rgba[at + 2] = 0; }
    }
    expect(decodePixels(rgba, width, height)).toEqual({ text: 'AST-128-0042', format: 'CODE_128' });
  });
  it('reports duplicates and unsafe/invalid URIs without following them', () => {
    const template = { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'ID' } };
    const dataset = { columns: ['ID'], records: [1, 2].map(id => ({ id: String(id), values: { ID: 'fieldlens://asset/A-1' } })), warnings: [] };
    expect(analyzeContent('fieldlens://asset/A-1', dataset, template)).toMatchObject({ matches: 2, scheme: 'fieldlens' });
    expect(analyzeContent('javascript:alert(1)', null, template).issues[0]).toMatch(/Unsupported/);
    expect(analyzeContent('fieldlens://asset/A%20B', null, template).issues).not.toEqual([]);
    expect(() => analyzeContent('x'.repeat(2001), null, template)).toThrow(/2,000/);
  });
});
