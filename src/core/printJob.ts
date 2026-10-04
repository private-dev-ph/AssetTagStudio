import type { AssetRecord, LabelTemplate, PageLayout, PageSettings } from '../types';
import { calculateLayout } from '../features/layout/pageLayout';
import { interpolatePayload, validateTemplate } from '../features/labels/renderer';
import { MAX_CELL_CHARACTERS, MAX_COLUMNS, MAX_ROWS } from '../features/import/limits';

export type PrintPlacement = {
  recordId: string; assetId: string; labelIndex: number; page: number; row: number; column: number;
  payload: string; position: { xMm: number; yMm: number }; widthMm: number; heightMm: number;
};
export type PrintJob = {
  version: 1; generatedAt: string; templateName: string; idField: string;
  records: AssetRecord[]; template: LabelTemplate; page: PageSettings; layout: PageLayout; labels: PrintPlacement[];
};

export type CreatePrintJobOptions = { templateName?: string; idField?: string; generatedAt?: string };
const MAX_PRINT_RECORDS = MAX_ROWS;

function validateRecords(records: AssetRecord[]): void {
  if (records.length > MAX_PRINT_RECORDS) throw new Error(`PDF export supports up to ${MAX_PRINT_RECORDS.toLocaleString()} records.`);
  const ids = new Set<string>();
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || ids.has(record.id) || typeof record.values !== 'object' || record.values === null || Array.isArray(record.values)) {
      throw new Error('Internal row identities must be unique and values must be a record.');
    }
    ids.add(record.id);
    const entries = Object.entries(record.values);
    if (entries.length > MAX_COLUMNS) throw new Error(`A record supports up to ${MAX_COLUMNS} columns.`);
    for (const [key, value] of entries) {
      if (!key.trim() || key.length > 200 || typeof value !== 'string' || value.length > MAX_CELL_CHARACTERS) throw new Error(`Invalid or oversized value in column “${key.slice(0, 200)}”.`);
    }
  }
}

function cloneRecord(record: AssetRecord): AssetRecord {
  return { id: record.id, values: Object.fromEntries(Object.entries(record.values)) };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createPrintJob(records: AssetRecord[], template: LabelTemplate, page: PageSettings, options: CreatePrintJobOptions = {}): PrintJob {
  if (!Array.isArray(records) || records.length === 0) throw new Error('Add at least one record before creating a print job.');
  validateRecords(records);
  validateTemplate(template);
  const recordSnapshot = records.map(cloneRecord);
  const templateSnapshot = structuredClone(template);
  const pageSnapshot = structuredClone(page);
  const layout = calculateLayout(templateSnapshot, pageSnapshot, recordSnapshot.length);
  const idField = options.idField ?? (template.code.field || '');
  const labels = recordSnapshot.map((record, index) => {
    const positionIndex = index % layout.labelsPerPage;
    const position = layout.positions[positionIndex]!;
    const pageIndex = Math.floor(index / layout.labelsPerPage);
    const rawId = idField && Object.hasOwn(record.values, idField) ? record.values[idField] : undefined;
    return {
      recordId: record.id,
      assetId: typeof rawId === 'string' && rawId.trim() ? rawId : record.id,
      labelIndex: index + 1,
      page: pageIndex + 1,
      row: Math.floor(positionIndex / layout.columns) + 1,
      column: positionIndex % layout.columns + 1,
      payload: interpolatePayload(record, templateSnapshot),
      position: { ...position },
      widthMm: templateSnapshot.widthMm,
      heightMm: templateSnapshot.heightMm,
    };
  });
  const job: PrintJob = {
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    templateName: options.templateName ?? 'Untitled template',
    idField,
    records: recordSnapshot,
    template: templateSnapshot,
    page: pageSnapshot,
    layout: structuredClone(layout),
    labels,
  };
  return deepFreeze(job);
}
