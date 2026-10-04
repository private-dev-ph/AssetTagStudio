import type { PrintJob } from '../../core/printJob';
import { csvText } from '../../core/download';

export type PrintManifest = {
  version: 1; generatedAt: string; template: string; codeType: PrintJob['template']['code']['type'];
  encodedField: string; calibration: { offsetXMm: number; offsetYMm: number };
  records: Array<{ recordId: string; assetId: string; labelIndex: number; page: number; row: number; column: number; xMm: number; yMm: number; payload: string }>;
};
export function manifestFromPrintJob(job: PrintJob): PrintManifest {
  return {
    version: 1, generatedAt: job.generatedAt, template: job.templateName, codeType: job.template.code.type,
    encodedField: job.idField, calibration: { offsetXMm: job.page.offsetXMm ?? 0, offsetYMm: job.page.offsetYMm ?? 0 },
    records: job.labels.map(label => ({ recordId: label.recordId, assetId: label.assetId, labelIndex: label.labelIndex, page: label.page, row: label.row, column: label.column, xMm: label.position.xMm, yMm: label.position.yMm, payload: label.payload })),
  };
}
export function manifestJson(job: PrintJob): string { return JSON.stringify(manifestFromPrintJob(job), null, 2); }
export function manifestCsv(job: PrintJob): string {
  const manifest = manifestFromPrintJob(job);
  return csvText([
    ['record_id', 'asset_id', 'label_index', 'page', 'row', 'column', 'x_mm', 'y_mm', 'payload'],
    ...manifest.records.map(row => [row.recordId, row.assetId, String(row.labelIndex), String(row.page), String(row.row), String(row.column), String(row.xMm), String(row.yMm), row.payload]),
  ]);
}
