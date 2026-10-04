import { ImportError, listSheets, parseCsv, parseWorkbook } from './parser';
import type { Dataset } from '../../types';

type Request =
  | { id: number; action: 'parseCsv'; text: string }
  | { id: number; action: 'listSheets'; buffer: ArrayBuffer }
  | { id: number; action: 'parseWorkbook'; buffer: ArrayBuffer; sheetName: string };
type Response = { id: number; ok: true; value: Dataset | string[] } | { id: number; ok: false; error: string };

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    let value: Dataset | string[];
    if (request.action === 'parseCsv') value = parseCsv(request.text);
    else if (request.action === 'listSheets') value = listSheets(request.buffer);
    else value = parseWorkbook(request.buffer, request.sheetName);
    const response: Response = { id: request.id, ok: true, value };
    self.postMessage(response);
  } catch (error) {
    const response: Response = {
      id: request.id,
      ok: false,
      error: error instanceof ImportError || error instanceof Error ? error.message : 'The file could not be imported.',
    };
    self.postMessage(response);
  }
};
