import type { AssetRecord, Dataset } from '../../types';
import { LONG_CELL_WARNING_CHARACTERS, MAX_CELL_CHARACTERS, MAX_COLUMNS, MAX_ROWS } from './limits';
import { ImportError } from './errors';

function isBlankRow(row: unknown[]): boolean {
  return row.every((value) => value == null || String(value).trim() === '');
}

function stringifyCell(value: unknown, row: number, column: number): string {
  if (value == null) return '';
  let text: string;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') text = String(value);
  else if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'object') {
    throw new ImportError(`Cell at row ${row}, column ${column} contains an unsupported value.`);
  } else text = String(value);
  if (text.length > MAX_CELL_CHARACTERS) {
    throw new ImportError(`Cell at row ${row}, column ${column} exceeds the ${MAX_CELL_CHARACTERS.toLocaleString()} character limit.`);
  }
  return text;
}

export function normalizeRows(rows: unknown[][]): Dataset {
  if (!Array.isArray(rows)) throw new ImportError('The imported data is not a row array.');
  if (rows.length > MAX_ROWS + 1) throw new ImportError(`The sheet exceeds the ${MAX_ROWS.toLocaleString()} data row limit.`);
  const firstNonEmpty = rows.findIndex((row) => Array.isArray(row) && !isBlankRow(row));
  if (firstNonEmpty < 0) throw new ImportError('The file is empty or contains no non-empty header row.');
  const headerRow = rows[firstNonEmpty];
  const headerCount = headerRow.length;
  if (headerCount === 0) throw new ImportError('The header row is empty.');
  if (headerCount > MAX_COLUMNS) throw new ImportError(`The file exceeds the ${MAX_COLUMNS} column limit.`);

  const columns = headerRow.map((cell, index) => {
    const header = stringifyCell(cell, firstNonEmpty + 1, index + 1).trim();
    if (!header) throw new ImportError(`Header ${index + 1} is empty. Give every column a name.`);
    return header;
  });
  const sourceHeaders = headerRow.map((cell, index) => stringifyCell(cell, firstNonEmpty + 1, index + 1));
  const seen = new Set<string>();
  for (const header of columns) {
    if (seen.has(header)) throw new ImportError(`Duplicate header "${header}". Column names must be unique.`);
    seen.add(header);
  }

  const records: AssetRecord[] = [];
  let removedEmptyRows = 0;
  const warnings: string[] = [];
  const emptyColumns = new Set(columns);
  let longCellCount = 0;
  const longCellExamples: string[] = [];
  for (let rowIndex = firstNonEmpty + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!Array.isArray(row) || isBlankRow(row)) { removedEmptyRows += 1; continue; }
    if (records.length >= MAX_ROWS) throw new ImportError(`The file exceeds the ${MAX_ROWS.toLocaleString()} data row limit.`);
    if (row.length > MAX_COLUMNS) throw new ImportError(`Row ${rowIndex + 1} exceeds the ${MAX_COLUMNS} column limit.`);
    if (row.length > columns.length && row.slice(columns.length).some((value) => value != null && String(value).trim() !== '')) {
      throw new ImportError(`Row ${rowIndex + 1} has values beyond the ${columns.length} declared headers.`);
    }
    const values = Object.create(null) as Record<string, string>;
    columns.forEach((column, index) => {
      const value = stringifyCell(row[index], rowIndex + 1, index + 1);
      values[column] = value;
      if (value.trim() !== '') emptyColumns.delete(column);
      if (value.length > LONG_CELL_WARNING_CHARACTERS) {
        longCellCount += 1;
        if (longCellExamples.length < 5) longCellExamples.push(`row ${rowIndex + 1}, column "${column}"`);
      }
    });
    records.push({ id: String(records.length + 1), values });
  }
  if (records.length === 0) throw new ImportError('The file has headers but no data rows.');
  if (emptyColumns.size) warnings.push(`Empty columns: ${[...emptyColumns].join(', ')}.`);
  if (longCellCount) {
    const remainder = longCellCount - longCellExamples.length;
    warnings.push(`${longCellCount} cell${longCellCount === 1 ? '' : 's'} exceed ${LONG_CELL_WARNING_CHARACTERS} characters (${longCellExamples.join('; ')}${remainder ? `; and ${remainder} more` : ''}).`);
  }
  return { columns, records, warnings, importAudit: { sourceHeaders, removedEmptyRows } };
}

export function validateIdentifiers(dataset: Dataset, field: string): string[] {
  if (!dataset.columns.includes(field)) return [`Identifier column "${field}" does not exist.`];
  const issues: string[] = [];
  const firstRows = new Map<string, number>();
  let omitted = 0;
  const addIssue = (message: string) => {
    if (issues.length < 10) issues.push(message);
    else omitted += 1;
  };
  dataset.records.forEach((record, index) => {
    const value = record.values[field]?.trim() ?? '';
    const row = index + 1;
    if (!value) {
      addIssue(`Row ${row} has no value for identifier "${field}".`);
      return;
    }
    const firstRow = firstRows.get(value);
    if (firstRow !== undefined) addIssue(`Row ${row} duplicates identifier "${value}" from row ${firstRow}.`);
    else firstRows.set(value, row);
  });
  if (omitted) issues.push(`${omitted} additional identifier issue${omitted === 1 ? '' : 's'} omitted.`);
  return issues;
}
