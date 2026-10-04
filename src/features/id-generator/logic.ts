import type { Dataset } from '../../types';
import { cloneValues, readValue } from '../../core/dataset';

export type IdGeneratorOptions = { column: string; pattern: string; prefix: string; suffix: string; start: number; padding: number; year: string; date: string; selectedIds: ReadonlySet<string>; blankOnly: boolean; overwrite: boolean };
export type IdPreviewRow = { rowId: string; before: string; after: string; status: 'ready' | 'collision' | 'unchanged'; message?: string };
const TOKEN = /\{([^{}]+)\}/g;
const MAX_PREVIEW = 5000;

export function previewIds(dataset: Dataset, options: IdGeneratorOptions): IdPreviewRow[] {
  if (!dataset.columns.includes(options.column)) throw new Error('Choose an existing identifier column.');
  if (!Number.isInteger(options.start) || options.start < 0 || options.start > 999_999_999) throw new Error('Sequence start must be from 0 to 999,999,999.');
  if (!Number.isInteger(options.padding) || options.padding < 1 || options.padding > 12) throw new Error('Zero padding must be from 1 to 12 digits.');
  if (options.pattern.length > 500 || options.prefix.length > 200 || options.suffix.length > 200) throw new Error('Pattern, prefix, or suffix is too long.');
  if (/[{}]/.test(options.pattern.replace(TOKEN, '')) || [...options.pattern.matchAll(TOKEN)].some(match => !match[1]!.trim())) throw new Error('Use tokens like {sequence}, {year}, {date}, or {Column Name}.');
  const selected = options.selectedIds;
  const targets = dataset.records.filter(record => selected.has(record.id) && (!options.blankOnly || !readValue(record, options.column).trim()) && (options.overwrite || !readValue(record, options.column).trim()));
  if (targets.length > MAX_PREVIEW) throw new Error(`Select no more than ${MAX_PREVIEW} rows for a preview.`);
  const targetIds = new Set(targets.map(row => row.id));
  const existing = new Set<string>();
  for (const record of dataset.records) {
    if (targetIds.has(record.id)) continue;
    const value = readValue(record, options.column).trim();
    if (value) existing.add(value);
  }
  const generated = new Set<string>();
  return targets.map((record, index) => {
    const sequence = String(options.start + index).padStart(options.padding, '0');
    const pattern = options.pattern.replace(TOKEN, (_token, key: string) => {
      if (key === 'sequence') return sequence;
      if (key === 'year') return options.year;
      if (key === 'date') return options.date;
      if (!Object.hasOwn(record.values, key)) throw new Error(`Pattern token “{${key}}” is not a dataset column.`);
      return readValue(record, key).trim();
    });
    const after = `${options.prefix}${pattern}${options.suffix}`;
    if (!after.trim()) throw new Error(`Row ${record.id} would receive an empty identifier.`);
    const collision = existing.has(after.trim()) || generated.has(after.trim());
    generated.add(after.trim());
    return { rowId: record.id, before: readValue(record, options.column), after, status: collision ? 'collision' : 'ready', message: collision ? 'Identifier already exists in the dataset or this preview.' : undefined };
  });
}

export function applyIdsToColumn(dataset: Dataset, column: string, preview: readonly IdPreviewRow[], allowCollisions = false): Dataset {
  if (!dataset.columns.includes(column)) throw new Error('Choose an existing identifier column.');
  if (!allowCollisions && preview.some(row => row.status === 'collision')) throw new Error('Resolve identifier collisions before applying.');
  const byId = new Map(preview.map(row => [row.rowId, row]));
  return { ...dataset, records: dataset.records.map(record => {
    const row = byId.get(record.id);
    if (!row) return record;
    const values = cloneValues(record.values);
    values[column] = row.after;
    return { ...record, values };
  }) };
}
