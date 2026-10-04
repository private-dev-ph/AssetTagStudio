import { clearEntries, deleteEntry, listEntries, putEntry } from '../storage/library';

export const ACTIVE_PRINTER_KEY = 'asset-tag-studio.active-printer.v1';
export type PrinterProfile = { id: string; name: string; offsetXMm: number; offsetYMm: number };
export type PrinterLibraryEntry = { id: string; name: string; json: string };
const MAX_NAME = 100;
export const MAX_PROFILE_BYTES = 10_000;

function validateName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME) throw new Error(`Printer profile name must contain 1–${MAX_NAME} characters.`);
}
function validateOffset(value: unknown, axis: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100) throw new Error(`${axis} calibration must be between -100 and 100 mm.`);
}
export function serializePrinterProfile(profile: PrinterProfile): string {
  validateName(profile.name); validateOffset(profile.offsetXMm, 'Horizontal'); validateOffset(profile.offsetYMm, 'Vertical');
  if (typeof profile.id !== 'string' || !profile.id || profile.id.length > 200) throw new Error('Printer profile ID is invalid.');
  return JSON.stringify({ version: 1, id: profile.id, name: profile.name.trim(), offsetXMm: profile.offsetXMm, offsetYMm: profile.offsetYMm });
}
export function parsePrinterProfile(raw: string): PrinterProfile {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_PROFILE_BYTES) throw new Error('Printer profile document is too large.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Printer profile must be valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Printer profile must be a JSON object.');
  const doc = value as Record<string, unknown>;
  if (Object.keys(doc).sort().join(',') !== 'id,name,offsetXMm,offsetYMm,version') throw new Error('Printer profile contains unsupported or missing settings.');
  if (doc.version !== 1) throw new Error('Unsupported printer profile version.');
  validateName(doc.name); validateOffset(doc.offsetXMm, 'Horizontal'); validateOffset(doc.offsetYMm, 'Vertical');
  if (typeof doc.id !== 'string' || !doc.id || doc.id.length > 200) throw new Error('Printer profile ID is invalid.');
  return { id: doc.id, name: doc.name.trim(), offsetXMm: doc.offsetXMm, offsetYMm: doc.offsetYMm };
}
export async function readPrinterProfileFile(file: Pick<File, 'size' | 'text'>): Promise<string> {
  if (file.size > MAX_PROFILE_BYTES) throw new Error('Printer profile document is too large.');
  const raw = await file.text();
  parsePrinterProfile(raw);
  return raw;
}
export async function listPrinterProfiles(): Promise<PrinterProfile[]> {
  const entries = await listEntries('printers') as PrinterLibraryEntry[];
  return entries.map(entry => {
    try {
      const profile = parsePrinterProfile(entry.json);
      if (entry.id !== profile.id || entry.name !== profile.name) throw new Error('Stored profile metadata does not match its settings.');
      return profile;
    } catch {
      throw new Error('Saved printer profiles are corrupted. Clear the printer profile library to recover.');
    }
  });
}
export async function putPrinterProfile(profile: PrinterProfile): Promise<void> {
  const json = serializePrinterProfile(profile);
  await putEntry('printers', { id: profile.id, name: profile.name.trim(), json });
}
export async function removePrinterProfile(id: string): Promise<void> { await deleteEntry('printers', id); }
export async function clearPrinterProfiles(): Promise<void> { await clearEntries('printers'); }
export function readActivePrinterId(storage?: Pick<Storage, 'getItem'>): string {
  try { return storage?.getItem(ACTIVE_PRINTER_KEY) ?? (typeof window === 'undefined' ? '' : window.localStorage.getItem(ACTIVE_PRINTER_KEY) ?? ''); }
  catch { return ''; }
}
export function setActivePrinterId(id: string, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? (typeof window === 'undefined' ? undefined : window.localStorage))?.setItem(ACTIVE_PRINTER_KEY, id); } catch { /* Current session remains usable. */ }
}
export function exportPrinterProfile(profile: PrinterProfile): string { return serializePrinterProfile(profile); }
export async function importPrinterProfile(raw: string, newId = crypto.randomUUID()): Promise<PrinterProfile> {
  const parsed = parsePrinterProfile(raw);
  const profile = { ...parsed, id: newId };
  await putPrinterProfile(profile);
  return profile;
}
