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
});
