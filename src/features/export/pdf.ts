import { PDFDocument, type PDFImage } from 'pdf-lib';
import type { AssetRecord, LabelTemplate, PageSettings } from '../../types';
import { mmToInches } from '../layout/pageLayout';
import { renderLabel, validateTemplate } from '../labels/renderer';
import { createPrintJob, type PrintJob } from '../../core/printJob';

export type PdfExportOptions = {
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
};

const MAX_RECORDS = 20_000;
const IMAGE_CACHE_BYTES = 24 * 1024 * 1024;
const RENDER_CACHE_BYTES = 4 * 1024 * 1024;
const BATCH_SIZE = 24;
const MM_TO_POINTS = 72 / 25.4;

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('PDF generation was cancelled.', 'AbortError');
}

function recordKey(record: AssetRecord, template: LabelTemplate): string {
  const usedKeys = new Set<string>(template.fields.map((field) => field.source));
  if (!template.code.payload) usedKeys.add(template.code.field);
  else {
    for (const match of template.code.payload.matchAll(/\{([^{}]+)\}/g)) usedKeys.add(match[1]!);
  }
  const usedValues = Object.fromEntries([...usedKeys].map((key) => [key, Object.hasOwn(record.values, key) ? record.values[key] : undefined]));
  return `${JSON.stringify(template)}:${JSON.stringify(usedValues)}`;
}

export async function generatePdf(
  records: AssetRecord[],
  template: LabelTemplate,
  page: PageSettings,
  options: PdfExportOptions = {},
): Promise<Uint8Array> {
  const job = createPrintJob(records, template, page);
  return generatePrintJobPdf(job, options);
}

export async function generatePrintJobPdf(job: PrintJob, options: PdfExportOptions = {}): Promise<Uint8Array> {
  const { records, template, page } = job;
  if (!Array.isArray(records) || records.length > MAX_RECORDS) {
    throw new Error(`PDF export supports up to ${MAX_RECORDS.toLocaleString()} records.`);
  }
  if (records.length === 0) throw new Error('Add at least one record before creating a PDF.');
  validateTemplate(template);
  if (job.labels.length !== records.length) throw new Error('Print job placements do not match its records.');
  checkCancelled(options.signal);
  const pdf = await PDFDocument.create();
  pdf.setTitle('Asset Tag Studio labels');
  const pageWidth = mmToInches(page.widthMm) * 72;
  const pageHeight = mmToInches(page.heightMm) * 72;
  const imageCache = new Map<string, { image: PDFImage; cost: number }>();
  const renderCache = new Map<string, string>();
  let imageCacheBytes = 0;
  let renderCacheBytes = 0;
  let completed = 0;
  let currentPageNumber = 0;
  let currentPage = pdf.addPage([pageWidth, pageHeight]);
  options.onProgress?.(0, records.length);

  for (let index = 0; index < records.length; index++) {
    checkCancelled(options.signal);
    const placement = job.labels[index]!;
    if (placement.labelIndex !== index + 1 || placement.page < 1 || placement.page > job.layout.pages) throw new Error('Print job placements are invalid.');
    if (placement.page !== currentPageNumber) {
      if (currentPageNumber > 0) currentPage = pdf.addPage([pageWidth, pageHeight]);
      currentPageNumber = placement.page;
    }
    const record = records[index]!;
    const cacheKey = recordKey(record, template);
    let dataUrl = renderCache.get(cacheKey);
    if (dataUrl) {
      renderCache.delete(cacheKey);
      renderCache.set(cacheKey, dataUrl);
    } else {
      dataUrl = await renderLabel(record, template);
      checkCancelled(options.signal);
      const size = dataUrl.length * 2;
      if (size <= RENDER_CACHE_BYTES) {
        while (renderCacheBytes + size > RENDER_CACHE_BYTES) {
          const oldest = renderCache.keys().next().value as string | undefined;
          if (!oldest) break;
          renderCacheBytes -= renderCache.get(oldest)!.length * 2;
          renderCache.delete(oldest);
        }
        renderCache.set(cacheKey, dataUrl);
        renderCacheBytes += size;
      }
    }

    let cachedImage = imageCache.get(dataUrl);
    if (cachedImage) {
      imageCache.delete(dataUrl);
      imageCache.set(dataUrl, cachedImage);
    } else {
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const binary = atob(base64);
      const pngBytes = new Uint8Array(binary.length);
      for (let byte = 0; byte < binary.length; byte++) pngBytes[byte] = binary.charCodeAt(byte);
      const image = await pdf.embedPng(pngBytes);
      // Compress now so PDF-lib releases the decoded pixel channels instead of
      // retaining every label's full RGB buffer until the final save.
      await image.embed();
      checkCancelled(options.signal);
      const size = pngBytes.byteLength + dataUrl.length * 2;
      if (size <= IMAGE_CACHE_BYTES) {
        while (imageCacheBytes + size > IMAGE_CACHE_BYTES) {
          const oldest = imageCache.keys().next().value as string | undefined;
          if (!oldest) break;
          imageCacheBytes -= imageCache.get(oldest)!.cost;
          imageCache.delete(oldest);
        }
        imageCache.set(dataUrl, { image, cost: size });
        imageCacheBytes += size;
      }
      cachedImage = { image, cost: size };
    }
    const position = placement.position;
    currentPage.drawImage(cachedImage.image, {
      x: position.xMm * MM_TO_POINTS,
      y: pageHeight - (position.yMm + template.heightMm) * MM_TO_POINTS,
      width: template.widthMm * MM_TO_POINTS,
      height: template.heightMm * MM_TO_POINTS,
    });
    completed++;
    if (completed % BATCH_SIZE === 0 || completed === records.length) {
      options.onProgress?.(completed, records.length);
      checkCancelled(options.signal);
      if (completed < records.length) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  checkCancelled(options.signal);
  const bytes = await pdf.save();
  checkCancelled(options.signal);
  return bytes;
}
