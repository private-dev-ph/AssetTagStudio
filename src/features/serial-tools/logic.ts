import type { Dataset } from '../../types';
import { cloneValues, readValue } from '../../core/dataset';

export type SerialOptions = { column: string; selectedIds: ReadonlySet<string>; mode: 'normalize' | 'extract' | 'validate' | 'deduplicate'; casing: 'upper' | 'lower' | 'preserve'; stripPrefix: string; removeSeparators: boolean; minLength: number; maxLength: number; knownPrefixes: string; pattern: string };
export type SerialPreviewRow = { rowId: string; before: string; after: string; status: 'ready' | 'invalid' | 'duplicate' | 'unchanged'; message?: string; drop?: boolean };
const MAX_ROWS = 2000;
const MAX_SERIAL_CHARS = 500;

export class PreviewGeneration {
  private generation = 0;
  begin(): number { this.generation += 1; return this.generation; }
  invalidate(): void { this.generation += 1; }
  isCurrent(generation: number): boolean { return generation === this.generation; }
}

function validatePattern(source: string): void {
  if (source.length > 120) throw new Error('Validation pattern must be 120 characters or fewer.');
  if (/\\[1-9]|\(\?[=!<]|\([^)]*[+*][^)]*\)[+*{]|(?:\*|\+|\{\d+,?\d*\})\s*(?:\*|\+|\{)/.test(source)) throw new Error('Pattern uses a construct that can take too long to validate. Simplify it before applying.');
}
export function testSerialPattern(source: string, values: string[]): Promise<boolean[]> {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('Pattern validation requires a browser worker.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./regex.worker.ts', import.meta.url), { type: 'module' });
    const id = Date.now() + Math.floor(Math.random() * 1_000_000);
    const timeout = setTimeout(() => finish(new Error('Pattern validation exceeded its time limit. Simplify the pattern.')), 100);
    let settled = false;
    const finish = (error?: Error, matches?: boolean[]) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); worker.terminate();
      if (error) reject(error); else resolve(matches ?? []);
    };
    worker.onmessage = event => {
      if (event.data?.id !== id) return;
      if (event.data.ok) finish(undefined, event.data.matches);
      else finish(new Error('Enter a valid regular expression.'));
    };
    worker.onerror = () => finish(new Error('Pattern worker failed. Simplify the pattern and try again.'));
    try { worker.postMessage({ id, source, values }); } catch { finish(new Error('Could not send serial values for validation.')); }
  });
}
function transform(value: string, options: SerialOptions): string {
  let result = value;
  if (options.mode === 'extract') {
    const match = result.match(/(?:\bSN\s*[:#-]?\s*)?([A-Za-z0-9][A-Za-z0-9._/-]*)/i);
    result = match?.[1] ?? '';
  }
  result = result.trim();
  if (options.stripPrefix && result.toLocaleLowerCase().startsWith(options.stripPrefix.toLocaleLowerCase())) result = result.slice(options.stripPrefix.length);
  result = result.replace(/\s+/g, '');
  if (options.removeSeparators) result = result.replace(/[._/-]+/g, '');
  if (options.casing === 'upper') result = result.toLocaleUpperCase();
  if (options.casing === 'lower') result = result.toLocaleLowerCase();
  return result;
}

export async function previewSerials(dataset: Dataset, options: SerialOptions, patternTester = testSerialPattern): Promise<SerialPreviewRow[]> {
  if (!dataset.columns.includes(options.column)) throw new Error('Choose an existing serial column.');
  if (options.minLength < 0 || options.maxLength < options.minLength || options.maxLength > MAX_SERIAL_CHARS) throw new Error(`Length rules must be within 0–${MAX_SERIAL_CHARS} characters.`);
  if (options.stripPrefix.length > 80) throw new Error('Prefix rule must be 80 characters or fewer.');
  if (options.pattern) validatePattern(options.pattern);
  const known = options.knownPrefixes.split(/[\n,;]/).map(item => item.trim().toLocaleUpperCase()).filter(Boolean).slice(0, 50);
  if (known.some(item => item.length > 40)) throw new Error('Known prefixes must be 40 characters or fewer.');
  const selected = dataset.records.filter(row => options.selectedIds.has(row.id));
  if (selected.length > MAX_ROWS) throw new Error(`Select no more than ${MAX_ROWS} rows for preview.`);
  const counts = new Map<string, number>();
  const rows: SerialPreviewRow[] = selected.map(row => {
    const before = readValue(row, options.column);
    const after = options.mode === 'validate' ? before : transform(before, options);
    const problems: string[] = [];
    if (options.mode !== 'validate' && options.mode !== 'deduplicate' && !after.trim()) problems.push('Result is blank.');
    if (after.length < options.minLength || after.length > options.maxLength) problems.push(`Length must be ${options.minLength}–${options.maxLength}.`);
    if (known.length && after && !known.some(prefix => after.toLocaleUpperCase().startsWith(prefix))) problems.push('Value does not start with a known prefix.');
    const key = after.toLocaleUpperCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    return { rowId: row.id, before, after, status: problems.length ? 'invalid' as const : before === after ? 'unchanged' as const : 'ready' as const, message: problems.join(' ') || undefined };
  });
  if (options.pattern) {
    const matches = await patternTester(options.pattern, rows.map(row => row.after).filter(Boolean));
    let index = 0;
    for (const row of rows) if (row.after) { if (!matches[index++]) { row.status = 'invalid'; row.message = [row.message, 'Value does not match the pattern.'].filter(Boolean).join(' '); } }
  }
  const duplicateIds = new Set<string>();
  const firstSeen = new Set<string>();
  for (const record of dataset.records) {
    const value = options.mode === 'validate' ? readValue(record, options.column) : transform(readValue(record, options.column), options);
    const key = value.toLocaleUpperCase();
    if (!key) continue;
    if (firstSeen.has(key)) duplicateIds.add(record.id);
    else firstSeen.add(key);
  }
  for (const row of rows) {
    if (duplicateIds.has(row.rowId)) {
      const duplicateMessage = `${counts.get(row.after.toLocaleUpperCase()) ?? 2} rows normalize to the same serial.`;
      row.status = row.status === 'invalid' ? 'invalid' : 'duplicate';
      row.message = row.message ? `${row.message} ${duplicateMessage}` : duplicateMessage;
      row.drop = options.mode === 'deduplicate';
    }
  }
  return rows;
}

export function applySerialPreview(dataset: Dataset, column: string, preview: readonly SerialPreviewRow[], dropDuplicates = false): Dataset {
  if (!dataset.columns.includes(column)) throw new Error('Choose an existing serial column.');
  if (preview.some(row => row.status === 'invalid')) throw new Error('Resolve invalid serial values before applying.');
  const byId = new Map(preview.map(row => [row.rowId, row]));
  const records = dataset.records.filter(row => !(dropDuplicates && byId.get(row.id)?.drop)).map(row => {
    const change = byId.get(row.id);
    if (!change) return row;
    const values = cloneValues(row.values); values[column] = change.after;
    return { ...row, values };
  });
  return { ...dataset, records };
}
