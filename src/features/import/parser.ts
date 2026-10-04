import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Dataset } from '../../types';
import { MAX_COLUMNS, MAX_FILE_BYTES, MAX_ROWS } from './limits';
import { ImportError } from './errors';
import { normalizeRows } from './normalize';

export { MAX_CELL_CHARACTERS, MAX_COLUMNS, MAX_FILE_BYTES, MAX_ROWS } from './limits';
export { ImportError } from './errors';
export { normalizeRows, validateIdentifiers } from './normalize';

function checkByteLength(text: string): void {
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) {
    throw new ImportError('The file exceeds the 10 MiB import limit.');
  }
}

export function parseCsv(text: string): Dataset {
  if (typeof text !== 'string') throw new ImportError('CSV input must be text.');
  checkByteLength(text);
  const rows: unknown[][] = [];
  let limitError = '';
  const result = Papa.parse<unknown[]>(text, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
    newline: text.includes('\r\n') ? '\r\n' : text.includes('\r') ? '\r' : '\n',
    step: (stepResult, parser) => {
      const errors = stepResult.errors.filter((issue) => issue.code !== 'UndetectableDelimiter');
      if (errors.length) {
        const issue = errors[0];
        const rowNumber = (issue.row ?? rows.length) + 1;
        limitError = issue.code === 'TooManyFields'
          ? `CSV row ${rowNumber} has more fields than its header.`
          : `Malformed CSV near row ${rowNumber}: ${issue.message}`;
        parser.abort();
        return;
      }
      if (rows.length >= MAX_ROWS + 1) {
        limitError = `The file exceeds the ${MAX_ROWS.toLocaleString()} data row limit.`;
        parser.abort();
        return;
      }
      if (!Array.isArray(stepResult.data)) {
        limitError = 'Malformed CSV: a row could not be read.';
        parser.abort();
        return;
      }
      const row = stepResult.data as unknown[];
      if (row.length > MAX_COLUMNS) {
        limitError = `CSV row ${rows.length + 1} exceeds the ${MAX_COLUMNS} column limit.`;
        parser.abort();
        return;
      }
      rows.push(row);
    },
  });
  if (limitError) throw new ImportError(limitError);
  const errors = result.errors.filter((issue) => issue.code !== 'UndetectableDelimiter');
  if (errors.length) {
    const issue = errors[0];
    throw new ImportError(`Malformed CSV: ${issue.message}`);
  }
  return normalizeRows(rows);
}

function workbookFromBuffer(buffer: ArrayBuffer): XLSX.WorkBook {
  if (!(buffer instanceof ArrayBuffer)) throw new ImportError('Excel input must be an ArrayBuffer.');
  if (buffer.byteLength > MAX_FILE_BYTES) throw new ImportError('The file exceeds the 10 MiB import limit.');
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));
  const isZipWorkbook = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const isLegacyWorkbook = bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 && bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1;
  if (!isZipWorkbook && !isLegacyWorkbook) throw new ImportError('The file does not have a valid XLSX or XLS workbook signature.');
  try {
    return XLSX.read(buffer, { type: 'array', sheetRows: MAX_ROWS + 2, cellFormula: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown workbook error';
    throw new ImportError(`Could not read the Excel workbook: ${detail}`);
  }
}

export function listSheets(buffer: ArrayBuffer): string[] {
  const workbook = workbookFromBuffer(buffer);
  if (workbook.SheetNames.length === 0) throw new ImportError('The Excel workbook contains no worksheets.');
  return [...workbook.SheetNames];
}

function validateSheetRange(sheet: XLSX.WorkSheet, sheetName: string): void {
  const declaredRange = (sheet as XLSX.WorkSheet & { '!fullref'?: string })['!fullref'] ?? sheet['!ref'];
  if (!declaredRange) throw new ImportError(`Worksheet "${sheetName}" is empty.`);
  let range: XLSX.Range;
  try {
    range = XLSX.utils.decode_range(declaredRange);
  } catch {
    throw new ImportError(`Worksheet "${sheetName}" has an invalid cell range.`);
  }
  const rowCount = range.e.r - range.s.r + 1;
  const columnCount = range.e.c - range.s.c + 1;
  if (rowCount > MAX_ROWS + 1) throw new ImportError(`Worksheet "${sheetName}" exceeds the ${MAX_ROWS.toLocaleString()} data row limit.`);
  if (columnCount > MAX_COLUMNS) throw new ImportError(`Worksheet "${sheetName}" exceeds the ${MAX_COLUMNS} column limit.`);
}

export function parseWorkbook(buffer: ArrayBuffer, sheetName: string): Dataset {
  if (typeof sheetName !== 'string' || !sheetName) throw new ImportError('Choose a worksheet to import.');
  const workbook = workbookFromBuffer(buffer);
  if (!workbook.SheetNames.includes(sheetName)) throw new ImportError(`Worksheet "${sheetName}" was not found in the workbook.`);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new ImportError(`Worksheet "${sheetName}" could not be read.`);
  validateSheetRange(sheet, sheetName);
  try {
    // SheetJS reads stored cell values only; formula expressions are never evaluated.
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    });
    return normalizeRows(rows);
  } catch (error) {
    if (error instanceof ImportError) throw error;
    const detail = error instanceof Error ? error.message : 'unknown worksheet error';
    throw new ImportError(`Could not import worksheet "${sheetName}": ${detail}`);
  }
}
