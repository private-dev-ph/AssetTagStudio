import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { DEFAULT_PAGE } from '../../types';
import { generateCalibrationPdf } from './calibrationPdf';

describe('printer calibration sheet', () => {
  it('creates a single vector sheet at the selected physical page size', async () => {
    const pdf = await PDFDocument.load(await generateCalibrationPdf(DEFAULT_PAGE));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPages()[0]!.getSize()).toEqual({ width: 210 / 25.4 * 72, height: 297 / 25.4 * 72 });
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 2_001])('rejects unsafe page width %s before ruler generation', async widthMm => {
    await expect(generateCalibrationPdf({ ...DEFAULT_PAGE, widthMm })).rejects.toThrow(/Page width/);
  });
  it.each([Number.NaN, Number.NEGATIVE_INFINITY, 0, 2_001])('rejects unsafe page height %s before ruler generation', async heightMm => {
    await expect(generateCalibrationPdf({ ...DEFAULT_PAGE, heightMm })).rejects.toThrow(/Page height/);
  });
  it('rejects custom paper too small for readable calibration marks', async () => {
    await expect(generateCalibrationPdf({ ...DEFAULT_PAGE, widthMm: 99 })).rejects.toThrow(/at least 100 × 80 mm/);
    await expect(generateCalibrationPdf({ ...DEFAULT_PAGE, heightMm: 79 })).rejects.toThrow(/at least 100 × 80 mm/);
  });
  it('generates on the smallest supported paper size', async () => {
    const bytes = await generateCalibrationPdf({ ...DEFAULT_PAGE, widthMm: 100, heightMm: 80 });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
