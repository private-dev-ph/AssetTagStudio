import type { Dataset } from '../../types';
import { cloneValues, readValue } from '../../core/dataset';
import { MAX_COLUMNS } from '../import/limits';
import { resolveCodePayload } from '../../core/payload';

export type HealthFinding = { code: string; severity: 'warning' | 'error'; message: string; rowIds?: string[]; column?: string };
export type HealthFix = 'trim' | 'headers' | 'empty-columns' | 'case';
export type HealthPreview = { dataset: Dataset; columnMap?: Record<string, string>; changed: number; description: string };
const FINDING_LIMIT = 100;
const LONG_VALUE = 500;
const addBounded = (items: HealthFinding[], item: HealthFinding) => { if (items.length < FINDING_LIMIT) items.push(item); };

export function auditDataset(dataset: Dataset, idField = '', serialField = '', nameField = '', payloadCode?: Parameters<typeof resolveCodePayload>[1]): HealthFinding[] {
  const findings: HealthFinding[] = [];
  const duplicates = (field: string, code: string, label: string) => {
    if (!dataset.columns.includes(field)) return;
    const groups = new Map<string, { count: number; rowIds: string[] }>();
    for (const row of dataset.records) {
      const value = readValue(row, field).trim();
      if (!value) continue;
      const group = groups.get(value);
      if (group) { group.count += 1; if (group.rowIds.length < 20) group.rowIds.push(row.id); }
      else groups.set(value, { count: 1, rowIds: [row.id] });
    }
    for (const [value, group] of groups) if (group.count > 1) addBounded(findings, { code, severity: 'error', column: field, rowIds: group.rowIds, message: `${group.count} rows share ${label} “${value}”.` });
  };
  duplicates(idField, 'duplicate-id', 'identifier'); duplicates(serialField, 'duplicate-serial', 'serial number');
  for (const row of dataset.records) {
    if (idField && dataset.columns.includes(idField) && !readValue(row, idField).trim()) addBounded(findings, { code: 'blank-id', severity: 'error', rowIds: [row.id], column: idField, message: `Row ${row.id} has a blank identifier.` });
    if (serialField && dataset.columns.includes(serialField) && !readValue(row, serialField).trim()) addBounded(findings, { code: 'blank-serial', severity: 'warning', rowIds: [row.id], column: serialField, message: `Row ${row.id} has a blank serial number.` });
    if (nameField && dataset.columns.includes(nameField) && !readValue(row, nameField).trim()) addBounded(findings, { code: 'blank-name', severity: 'warning', rowIds: [row.id], column: nameField, message: `Row ${row.id} has a blank asset name.` });
    for (const column of dataset.columns) {
      const value = readValue(row, column);
      if (value.length > LONG_VALUE) addBounded(findings, { code: 'long-value', severity: 'warning', rowIds: [row.id], column, message: `Row ${row.id} has ${value.length} characters in “${column}”.` });
      if (value !== value.trim()) addBounded(findings, { code: 'whitespace', severity: 'warning', rowIds: [row.id], column, message: `Row ${row.id} has leading or trailing whitespace in “${column}”.` });
      if (value && value !== value.toLocaleLowerCase() && value !== value.toLocaleUpperCase()) addBounded(findings, { code: 'inconsistent-case', severity: 'warning', rowIds: [row.id], column, message: `Row ${row.id} uses mixed casing in “${column}”.` });
    }
    if (payloadCode) {
      try { resolveCodePayload(row, payloadCode); } catch (error) { addBounded(findings, { code: 'invalid-payload', severity: 'error', rowIds: [row.id], message: error instanceof Error ? error.message : 'Payload could not be resolved.' }); }
    }
  }
  for (const column of dataset.columns) if (dataset.records.every(row => !readValue(row, column).trim())) addBounded(findings, { code: 'empty-column', severity: 'warning', column, message: `Column “${column}” is empty.` });
  if (dataset.importAudit?.removedEmptyRows) addBounded(findings, { code: 'empty-rows', severity: 'warning', message: `${dataset.importAudit.removedEmptyRows} fully empty row(s) were skipped during import.` });
  const sourceHeaders = dataset.importAudit?.sourceHeaders ?? dataset.columns;
  const headerGroups = new Map<string, number[]>();
  for (const [index, source] of sourceHeaders.entries()) {
    const normalized = source.trim().replace(/\s+/g, ' ');
    const column = dataset.columns[index];
    if (normalized) headerGroups.set(normalized.toLocaleLowerCase(), [...(headerGroups.get(normalized.toLocaleLowerCase()) ?? []), index]);
    if (normalized !== source) addBounded(findings, { code: 'header-whitespace', severity: 'warning', column, message: `Imported header “${source}” contains edge or repeated whitespace.` });
    if (normalized && normalized !== normalized.toLocaleLowerCase() && normalized !== normalized.toLocaleUpperCase()) addBounded(findings, { code: 'header-case', severity: 'warning', column, message: `Header “${source}” has mixed casing.` });
  }
  for (const indexes of headerGroups.values()) if (indexes.length > 1) addBounded(findings, { code: 'duplicate-header', severity: 'error', message: `Headers ${indexes.map(index => `“${sourceHeaders[index]}”`).join(', ')} match when whitespace and casing are normalized.` });
  return findings;
}

export function previewHealthFix(dataset: Dataset, fix: HealthFix, column?: string): HealthPreview {
  let columns = [...dataset.columns];
  let columnMap: Record<string, string> | undefined;
  let changed = 0;
  if (fix === 'empty-columns') {
    const keep = columns.filter(name => dataset.records.some(row => readValue(row, name).trim()));
    if (!keep.length) throw new Error('At least one column must remain.');
    changed = columns.length - keep.length; columns = keep;
  } else if (fix === 'headers') {
    columnMap = Object.create(null) as Record<string, string>;
    columns = columns.map(name => { const next = name.trim().replace(/\s+/g, ' '); if (!next) throw new Error('Header fixes cannot create a blank column name.'); columnMap![name] = next; if (next !== name) changed += 1; return next; });
    if (new Set(columns).size !== columns.length) throw new Error('Header fixes would create duplicate names. Resolve those columns before applying.');
    if (columns.some(name => name.length > 200)) throw new Error('A normalized header exceeds 200 characters.');
    if (columns.length > MAX_COLUMNS) throw new Error('Too many columns.');
  }
  const records = dataset.records.map(row => {
    const values = cloneValues(row.values);
    if (fix === 'trim') for (const name of dataset.columns) { const next = readValue(row, name).trim(); if (next !== readValue(row, name)) { values[name] = next; changed += 1; } }
    if (fix === 'case') {
      if (!column || !dataset.columns.includes(column)) throw new Error('Choose a column to normalize.');
      const next = readValue(row, column).toLocaleUpperCase(); if (next !== readValue(row, column)) { values[column] = next; changed += 1; }
    }
    if (fix === 'headers') {
      const remapped = Object.create(null) as Record<string, string>;
      for (const old of dataset.columns) remapped[columnMap![old]!] = values[old]!;
      return { ...row, values: remapped };
    }
    return { ...row, values };
  });
  const nextDataset = { ...dataset, columns, records,
    ...(fix === 'headers' && dataset.importAudit ? { importAudit: { ...dataset.importAudit, sourceHeaders: columns } } : {}),
  };
  return { dataset: nextDataset, columnMap, changed, description: `${fix === 'headers' ? 'Normalize headers' : fix === 'empty-columns' ? 'Remove empty columns' : fix === 'case' ? `Normalize ${column} casing` : 'Trim cell whitespace'} (${changed} change${changed === 1 ? '' : 's'})` };
}
