import type { Dataset } from '../../types';
import { MAX_FILE_BYTES } from './limits';
import { ImportError } from './errors';

type WorkerResponse<T> = { id: number; ok: true; value: T } | { id: number; ok: false; error: string };
type ImportKind = 'csv' | 'excel';

let nextRequestId = 1;
const WORKER_TIMEOUT_MS = 20_000;

function kindOf(file: File): ImportKind {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'csv' || file.type === 'text/csv') return 'csv';
  if (extension === 'xlsx' || extension === 'xls' || file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'excel';
  throw new ImportError('Choose a CSV, XLSX, or XLS file.');
}

function checkFile(file: File): ImportKind {
  if (file.size > MAX_FILE_BYTES) throw new ImportError('The file exceeds the 10 MiB import limit.');
  return kindOf(file);
}

function runWorker<T>(
  payload: Record<string, unknown>,
  transfer: Transferable[] = [],
): Promise<T> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      reject(new ImportError('The import worker could not be started in this browser.'));
      return;
    }
    const id = nextRequestId++;
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(error);
      else resolve(value as T);
    };
    const timer = setTimeout(() => finish(new ImportError('Import took too long and was stopped. Try a smaller or simpler file.')), WORKER_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<WorkerResponse<T>>) => {
      const message = event.data;
      if (!message || message.id !== id) return;
      if (message.ok) finish(undefined, message.value);
      else finish(new ImportError(message.error));
    };
    worker.onerror = () => finish(new ImportError('The import worker failed while reading the file.'));
    worker.onmessageerror = () => finish(new ImportError('The import worker returned an unreadable result.'));
    try {
      worker.postMessage({ ...payload, id }, transfer);
    } catch {
      finish(new ImportError('The file could not be sent to the import worker.'));
    }
  });
}

export async function inspectFile(file: File): Promise<{ kind: 'csv'; dataset: Dataset } | { kind: 'excel'; sheets: string[] }> {
  const kind = checkFile(file);
  if (kind === 'csv') {
    let text: string;
    try {
      text = await file.text();
    } catch {
      throw new ImportError('The CSV file could not be read.');
    }
    const dataset = await runWorker<Dataset>({ action: 'parseCsv', text });
    return { kind: 'csv', dataset };
  }
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new ImportError('The Excel file could not be read.');
  }
  const sheets = await runWorker<string[]>({ action: 'listSheets', buffer }, [buffer]);
  return { kind: 'excel', sheets };
}

export async function readSheet(file: File, sheetName: string): Promise<Dataset> {
  const kind = checkFile(file);
  if (kind !== 'excel') throw new ImportError('Worksheet selection is only available for Excel files.');
  if (!sheetName) throw new ImportError('Choose a worksheet to import.');
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new ImportError('The Excel file could not be read.');
  }
  return runWorker<Dataset>({ action: 'parseWorkbook', buffer, sheetName }, [buffer]);
}
