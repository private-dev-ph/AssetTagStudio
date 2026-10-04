import type { AssetRecord, Dataset } from '../types';
import { MAX_CELL_CHARACTERS, MAX_COLUMNS, MAX_ROWS } from '../features/import/limits';

export function readValue(record: AssetRecord, column: string): string {
  return Object.hasOwn(record.values, column) && typeof record.values[column] === 'string' ? record.values[column] : '';
}
export function cloneValues(values: Record<string, string>): Record<string, string> {
  return Object.assign(Object.create(null) as Record<string, string>, values);
}
export function validateDataset(dataset: Dataset): void {
  if (!dataset || !Array.isArray(dataset.columns) || !Array.isArray(dataset.records) || !Array.isArray(dataset.warnings)) throw new Error('Choose a valid dataset.');
  if (!dataset.columns.length || dataset.columns.length > MAX_COLUMNS) throw new Error(`A dataset needs 1–${MAX_COLUMNS} columns.`);
  if (dataset.columns.some(c => typeof c !== 'string' || !c.trim() || c.length > 200) || new Set(dataset.columns).size !== dataset.columns.length) throw new Error('Column names must be unique, nonempty text up to 200 characters.');
  if (dataset.records.length > MAX_ROWS) throw new Error(`A dataset supports up to ${MAX_ROWS} rows.`);
  const ids = new Set<string>();
  for (const record of dataset.records) {
    if (!record || typeof record.id !== 'string' || ids.has(record.id) || typeof record.values !== 'object' || record.values === null || Array.isArray(record.values)) throw new Error('Internal row identities must be unique and values must be a record.');
    ids.add(record.id);
    for (const column of dataset.columns) {
      if (!Object.hasOwn(record.values, column) || typeof record.values[column] !== 'string' || record.values[column].length > MAX_CELL_CHARACTERS) throw new Error(`Invalid or oversized value in column “${column}”.`);
    }
  }
}
export function estimateDatasetBytes(dataset: Dataset): number {
  return 2 * (dataset.columns.join('').length + dataset.records.reduce((sum, record) => sum + record.id.length + dataset.columns.reduce((n, c) => n + c.length + readValue(record, c).length, 0), 0));
}

// Store immutable references, never mutate or serialize the user's dataset into storage.
export class UndoHistory<T> {
  private items: { value: T; bytes: number; description: string }[] = [];
  constructor(private readonly estimate: (value: T) => number, private readonly limitBytes = 24 * 1024 * 1024, private readonly limitEntries = 8) {}
  get canUndo(): boolean { return this.items.length > 0; }
  get description(): string { return this.items.at(-1)?.description ?? ''; }
  push(value: T, description: string): void {
    const bytes = this.estimate(value);
    if (!Number.isFinite(bytes) || bytes < 0 || bytes > this.limitBytes) throw new Error('This change exceeds the in-memory undo limit. Reduce the dataset before applying it.');
    while (this.items.length >= this.limitEntries || this.items.reduce((sum, i) => sum + i.bytes, 0) + bytes > this.limitBytes) this.items.shift();
    this.items.push({ value, bytes, description });
  }
  pop(): T | undefined { return this.items.pop()?.value; }
  clear(): void { this.items = []; }
}
