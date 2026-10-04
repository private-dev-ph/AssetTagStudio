import { estimateDatasetBytes, validateDataset } from '../core/dataset';
import { payloadReferences } from '../core/payload';
import type { Dataset, LabelTemplate, PageSettings } from '../types';
import type { StudioView } from './contracts';

export const NAVIGATION: { group: string; items: { view: StudioView; title: string }[] }[] = [
  { group: 'Create', items: [{ view: 'asset-labels', title: 'Asset labels' }, { view: 'cable-labels', title: 'Cable labels' }, { view: 'location-labels', title: 'Location labels' }, { view: 'codes', title: 'QR & barcode' }] },
  { group: 'Data', items: [{ view: 'data-health', title: 'Data health' }, { view: 'id-generator', title: 'Asset ID generator' }, { view: 'serial-tools', title: 'Serial tools' }] },
  { group: 'Design', items: [{ view: 'templates', title: 'Templates' }, { view: 'payload-builder', title: 'QR payload builder' }, { view: 'calibration', title: 'Printer setup' }] },
  { group: 'Tools', items: [{ view: 'code-inspector', title: 'Code inspector' }, { view: 'manifest', title: 'Asset manifest' }, { view: 'fieldlens', title: 'FieldLens export' }] },
];
export function viewFromHash(hash: string): StudioView {
  const key = hash.replace(/^#\/?/, '');
  return NAVIGATION.flatMap(group => group.items).find(item => item.view === key)?.view ?? 'asset-labels';
}
export type WorkspaceSnapshot = { dataset: Dataset; template: LabelTemplate; page: PageSettings; idField: string; selected: Set<string>; hiddenFields: Set<string> };
export function estimateSnapshot(snapshot: WorkspaceSnapshot): number {
  return estimateDatasetBytes(snapshot.dataset) + JSON.stringify({ template: snapshot.template, page: snapshot.page }).length * 2 + (snapshot.selected.size + snapshot.hiddenFields.size) * 128;
}
// Validate and remap every reference atomically; no partially renamed working state.
export function transformedWorkspace(current: WorkspaceSnapshot, next: Dataset, columnMap: Record<string, string> = {}): WorkspaceSnapshot {
  validateDataset(next);
  const renamed = (key: string) => Object.hasOwn(columnMap, key) ? columnMap[key] : key;
  for (const [old, replacement] of Object.entries(columnMap)) {
    if (!current.dataset.columns.includes(old) || !next.columns.includes(replacement)) throw new Error('Column mappings must refer to existing source and destination columns.');
  }
  const template: LabelTemplate = {
    ...current.template, code: { ...current.template.code, field: renamed(current.template.code.field), payload: current.template.code.payload.replace(/\{([^{}]+)\}/g, (_, key: string) => `{${renamed(key)}}`) },
    fields: current.template.fields.map(field => ({ ...field, source: renamed(field.source), label: field.label === field.source ? renamed(field.label) : field.label })),
  };
  const rowIds = new Set(next.records.map(record => record.id));
  return { ...current, dataset: next, template, idField: renamed(current.idField), selected: new Set([...current.selected].filter(id => rowIds.has(id))), hiddenFields: new Set([...current.hiddenFields].map(renamed).filter(key => next.columns.includes(key))) };
}
export function checkTemplateMapping(template: LabelTemplate, dataset: Dataset | null): void {
  if (!dataset) return;
  const references = [...template.fields.map(field => field.source), ...(template.code.type === 'none' ? [] : template.code.payload ? payloadReferences(template.code.payload) : [template.code.field])];
  const missing = [...new Set(references.filter(key => !dataset.columns.includes(key)))];
  if (missing.length) throw new Error(`Map these missing columns before applying the template: ${missing.join(', ')}.`);
}
