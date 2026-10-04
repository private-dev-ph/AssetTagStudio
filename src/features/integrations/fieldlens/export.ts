import type { Dataset, LabelTemplate, PageSettings } from '../../../types';
import { createPrintJob, type PrintJob } from '../../../core/printJob';
import { csvText } from '../../../core/download';
import { readValue, validateDataset } from '../../../core/dataset';

export type FieldLensMapping = { idField: string; nameField: string; assetTypeField: string; serialField?: string; locationField?: string };
const FORMULA_ID = /^[\s]*[=+@-]/;
export function prepareFieldLensJob(dataset: Dataset, selectedIds: ReadonlySet<string>, mapping: FieldLensMapping, template: LabelTemplate, page: PageSettings): PrintJob {
  validateDataset(dataset);
  for (const [label, field] of [['Asset ID', mapping.idField], ['Name', mapping.nameField], ['Asset type', mapping.assetTypeField]] as const) {
    if (!field || !dataset.columns.includes(field)) throw new Error(`Map a valid ${label.toLowerCase()} column before exporting to FieldLens.`);
  }
  for (const [label, field] of [['Serial', mapping.serialField], ['Location', mapping.locationField]] as const) {
    if (field && !dataset.columns.includes(field)) throw new Error(`Map a valid ${label.toLowerCase()} column or leave it unmapped.`);
  }
  if (!selectedIds.size) throw new Error('Select at least one asset for FieldLens export.');
  const records = dataset.records.filter(record => selectedIds.has(record.id));
  if (records.length !== selectedIds.size) throw new Error('One or more selected rows are no longer in the current dataset.');
  const seen = new Set<string>();
  for (const record of records) {
    const id = readValue(record, mapping.idField);
    if (!id.trim()) throw new Error(`Record “${record.id}” has no FieldLens asset ID.`);
    if (FORMULA_ID.test(id)) throw new Error(`FieldLens ID “${id}” starts with a spreadsheet formula character. Change the ID before export so the QR and CSV retain the same value safely.`);
    if (seen.has(id)) throw new Error(`FieldLens asset ID “${id}” appears more than once in the selected rows.`);
    seen.add(id);
  }
  const fieldlensTemplate: LabelTemplate = {
    ...structuredClone(template), mode: 'asset', textLayout: 'standard',
    code: { ...template.code, type: 'qr', field: mapping.idField, payload: `fieldlens://asset/{${mapping.idField}}`, payloadMode: 'fieldlens' },
  };
  return createPrintJob(records, fieldlensTemplate, page, { templateName: 'FieldLens Asset Labels', idField: mapping.idField });
}
export function fieldLensCsv(job: PrintJob, mapping: FieldLensMapping): string {
  const byId = new Map(job.records.map(record => [record.id, record]));
  const rows = job.labels.map(label => {
    const record = byId.get(label.recordId);
    if (!record || label.payload !== `fieldlens://asset/${label.assetId}`) throw new Error('Print job FieldLens IDs do not match encoded QR identifiers.');
    return [label.assetId, readValue(record, mapping.nameField), readValue(record, mapping.assetTypeField), mapping.serialField ? readValue(record, mapping.serialField) : '', mapping.locationField ? readValue(record, mapping.locationField) : ''];
  });
  return csvText([['asset_id', 'name', 'asset_type', 'serial', 'location'], ...rows]);
}
