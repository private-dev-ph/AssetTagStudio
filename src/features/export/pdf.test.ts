import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFPage } from 'pdf-lib';
import type { AssetRecord, LabelTemplate, PageSettings } from '../../types';
import { DEFAULT_TEMPLATE } from '../../types';
import { generatePdf, generatePrintJobPdf } from './pdf';
import { createPrintJob } from '../../core/printJob';
import { manifestFromPrintJob } from '../manifest/manifest';

const renderLabel = vi.hoisted(() => vi.fn());
vi.mock('../labels/renderer', async () => {
  const actual = await vi.importActual<typeof import('../labels/renderer')>('../labels/renderer');
  return { ...actual, renderLabel };
});

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lcsAAAAASUVORK5CYII=';
const template: LabelTemplate = { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'ID' } };
const page: PageSettings = {
  preset: 'Custom', widthMm: 63, heightMm: 33,
  marginLeftMm: 1, marginRightMm: 1, marginTopMm: 1, marginBottomMm: 1, gapXMm: 0, gapYMm: 0,
};
const records: AssetRecord[] = [{ id: 'a', values: { ID: 'A' } }, { id: 'b', values: { ID: 'B' } }];

afterEach(() => renderLabel.mockReset());

describe('PDF generation', () => {
  it('draws the exact signed-calibrated manifest placements across pages', async () => {
    renderLabel.mockResolvedValue(onePixelPng);
    const job = createPrintJob(records, template, { ...page, offsetXMm: 0.5, offsetYMm: -0.25 });
    const manifest = manifestFromPrintJob(job);
    const draw = vi.spyOn(PDFPage.prototype, 'drawImage');
    try {
      const bytes = await generatePrintJobPdf(job);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
      expect(draw).toHaveBeenCalledTimes(manifest.records.length);
      manifest.records.forEach((row, index) => {
        const placement = draw.mock.calls[index]![1]!;
        expect(placement.x).toBeCloseTo(row.xMm * 72 / 25.4, 10);
        expect(placement.y).toBeCloseTo(page.heightMm * 72 / 25.4 - (row.yMm + template.heightMm) * (72 / 25.4), 10);
        expect(placement.width).toBeCloseTo(template.widthMm * (72 / 25.4), 10);
        expect(placement.height).toBeCloseTo(template.heightMm * (72 / 25.4), 10);
      });
    } finally { draw.mockRestore(); }
  });

  it('keeps physical page dimensions, pagination, and progress ordering', async () => {
    renderLabel.mockResolvedValue(onePixelPng);
    const progress: number[] = [];
    const bytes = await generatePdf(records, template, page, { onProgress: (done) => progress.push(done) });
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(2);
    expect(parsed.getPages()[0]!.getSize()).toEqual({ width: 63 / 25.4 * 72, height: 33 / 25.4 * 72 });
    expect(progress).toEqual([0, 2]);
    expect(renderLabel).toHaveBeenCalledTimes(2);
  });

  it('rejects empty exports and observes cancellation before work', async () => {
    await expect(generatePdf([], template, page)).rejects.toThrow(/Add at least one record/);
    const controller = new AbortController();
    controller.abort();
    await expect(generatePdf(records, template, page, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(renderLabel).not.toHaveBeenCalled();
  });

  it('cancels while rendering and propagates renderer failures', async () => {
    const controller = new AbortController();
    renderLabel.mockImplementation(async () => { controller.abort(); return onePixelPng; });
    await expect(generatePdf(records, template, page, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    renderLabel.mockRejectedValueOnce(new Error('bad label'));
    await expect(generatePdf(records, template, page)).rejects.toThrow('bad label');
  });

  it('renders repeated labels once even when records have different ids', async () => {
    renderLabel.mockResolvedValue(onePixelPng);
    await generatePdf([
      { id: 'first', values: { ID: 'same' } },
      { id: 'second', values: { ID: 'same' } },
    ], template, page);
    expect(renderLabel).toHaveBeenCalledTimes(1);
  });

  it('embeds each new image before rendering the next label', async () => {
    const embed = vi.spyOn((await import('pdf-lib')).PDFImage.prototype, 'embed');
    try {
      renderLabel.mockImplementation(async () => {
        if (renderLabel.mock.calls.length === 2) expect(embed).toHaveBeenCalled();
        return onePixelPng;
      });
      const bytes = await generatePdf(records, template, page);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    } finally { embed.mockRestore(); }
  });
});
