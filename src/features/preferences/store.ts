import { DEFAULT_PAGE, DEFAULT_TEMPLATE, type LabelTemplate, type PageSettings } from '../../types';

export type Theme = 'light' | 'dark';
export type Preferences = { theme: Theme; unit: 'mm' | 'in'; template: LabelTemplate; page: PageSettings; hiddenFields: string[] };

export const PREFERENCES_KEY = 'asset-tag-studio.preferences.v1';
export const DEFAULT_PREFERENCES: Preferences = { theme: 'light', unit: 'mm', template: DEFAULT_TEMPLATE, page: DEFAULT_PAGE, hiddenFields: [] };

function finite(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
function readTemplate(value: unknown): LabelTemplate {
  if (typeof value !== 'object' || value === null) return DEFAULT_TEMPLATE;
  const candidate = value as Record<string, unknown>;
  const code = typeof candidate.code === 'object' && candidate.code !== null ? candidate.code as Record<string, unknown> : {};
  const fields = Array.isArray(candidate.fields) ? candidate.fields.slice(0, 32).flatMap((item): LabelTemplate['fields'] => {
    if (typeof item !== 'object' || item === null) return [];
    const field = item as Record<string, unknown>;
    if (typeof field.source !== 'string' || typeof field.label !== 'string' || !finite(field.fontSize, 5, 30) || typeof field.bold !== 'boolean') return [];
    return [{ source: field.source.slice(0, 200), label: field.label.slice(0, 200), fontSize: field.fontSize, bold: field.bold }];
  }) : [];
  return {
    widthMm: finite(candidate.widthMm, 10, 200) ? candidate.widthMm : DEFAULT_TEMPLATE.widthMm,
    heightMm: finite(candidate.heightMm, 10, 200) ? candidate.heightMm : DEFAULT_TEMPLATE.heightMm,
    paddingMm: finite(candidate.paddingMm, 0, 30) ? candidate.paddingMm : DEFAULT_TEMPLATE.paddingMm,
    border: typeof candidate.border === 'boolean' ? candidate.border : DEFAULT_TEMPLATE.border,
    alignment: candidate.alignment === 'center' || candidate.alignment === 'right' ? candidate.alignment : 'left',
    ...(candidate.mode === 'cable' || candidate.mode === 'location' || candidate.mode === 'code' || candidate.mode === 'asset' ? { mode: candidate.mode } : {}),
    ...(candidate.textLayout === 'mirrored' ? { textLayout: 'mirrored' as const } : {}),
    fields,
    code: {
      type: code.type === 'code128' ? 'code128' : code.type === 'none' ? 'none' : 'qr',
      field: typeof code.field === 'string' ? code.field.slice(0, 200) : '',
      sizeMm: finite(code.sizeMm, 8, 60) ? code.sizeMm : DEFAULT_TEMPLATE.code.sizeMm,
      barcodeScale: finite(code.barcodeScale, 0.8, 3) ? code.barcodeScale : 1,
      payload: typeof code.payload === 'string' && code.payload.length <= 2000 ? code.payload : '',
      ...(code.payloadMode === 'url' || code.payloadMode === 'fieldlens' || code.payloadMode === 'location' || code.payloadMode === 'text' ? { payloadMode: code.payloadMode } : {}),
      barcodeHeightMm: finite(code.barcodeHeightMm, 5, 40) ? code.barcodeHeightMm : DEFAULT_TEMPLATE.code.barcodeHeightMm,
      barcodeText: typeof code.barcodeText === 'boolean' ? code.barcodeText : true,
      barcodeTextPosition: code.barcodeTextPosition === 'top' ? 'top' : 'bottom',
    },
  };
}
function readPage(value: unknown): PageSettings {
  if (typeof value !== 'object' || value === null) return DEFAULT_PAGE;
  const candidate = value as Record<string, unknown>;
  const dimension = (key: string, fallback: number, max: number, min = 0) => finite(candidate[key], min, max) ? candidate[key] as number : fallback;
  const preset = candidate.preset === 'A5' || candidate.preset === 'Letter' || candidate.preset === 'Custom' ? candidate.preset : 'A4';
  return { preset, widthMm: dimension('widthMm', DEFAULT_PAGE.widthMm, 500, 1), heightMm: dimension('heightMm', DEFAULT_PAGE.heightMm, 700, 1), marginTopMm: dimension('marginTopMm', 10, 100), marginBottomMm: dimension('marginBottomMm', 10, 100), marginLeftMm: dimension('marginLeftMm', 10, 100), marginRightMm: dimension('marginRightMm', 10, 100), gapXMm: dimension('gapXMm', 3, 50), gapYMm: dimension('gapYMm', 3, 50), ...(finite(candidate.offsetXMm, -100, 100) ? { offsetXMm: candidate.offsetXMm } : {}), ...(finite(candidate.offsetYMm, -100, 100) ? { offsetYMm: candidate.offsetYMm } : {}) };
}

export function parsePreferences(raw: string | null): Preferences {
  if (raw === null) return { ...DEFAULT_PREFERENCES };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...DEFAULT_PREFERENCES };
    const candidate = value as Record<string, unknown>;
    return {
      theme: candidate.theme === 'dark' || candidate.theme === 'light' ? candidate.theme : DEFAULT_PREFERENCES.theme,
      unit: candidate.unit === 'in' || candidate.unit === 'mm' ? candidate.unit : DEFAULT_PREFERENCES.unit,
      template: readTemplate(candidate.template),
      page: readPage(candidate.page),
      hiddenFields: Array.isArray(candidate.hiddenFields) ? candidate.hiddenFields.slice(0, 6).filter((field): field is string => typeof field === 'string').map((field) => field.slice(0, 200)) : [],
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function loadPreferences(storage?: Pick<Storage, 'getItem'>): Preferences {
  try {
    const safeStorage = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    return parsePreferences(safeStorage?.getItem(PREFERENCES_KEY) ?? null);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences: Preferences, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const safeStorage = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    safeStorage?.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be disabled or full; the app remains usable for this session.
  }
}
