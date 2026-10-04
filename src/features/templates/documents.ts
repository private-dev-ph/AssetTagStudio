import type { LabelTemplate, PageSettings } from '../../types';

export const TEMPLATE_DOCUMENT_VERSION = 1;
export const MAX_TEMPLATE_DOCUMENT_BYTES = 128 * 1024;
export const MAX_TEMPLATE_NAME_LENGTH = 100;

export type TemplateDocument = {
  version: 1;
  kind: 'template';
  name: string;
  template: LabelTemplate;
  page?: PageSettings;
};

const TEMPLATE_KEYS = ['widthMm', 'heightMm', 'paddingMm', 'border', 'alignment', 'code', 'fields', 'mode', 'textLayout'] as const;
const CODE_KEYS = ['type', 'field', 'sizeMm', 'payload', 'barcodeHeightMm', 'barcodeScale', 'barcodeText', 'barcodeTextPosition', 'payloadMode'] as const;
const FIELD_KEYS = ['source', 'label', 'fontSize', 'bold'] as const;
const PAGE_KEYS = ['preset', 'widthMm', 'heightMm', 'marginTopMm', 'marginBottomMm', 'marginLeftMm', 'marginRightMm', 'gapXMm', 'gapYMm', 'offsetXMm', 'offsetYMm'] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string, required: readonly string[] = allowed) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} has an unsupported property: ${key}.`);
  for (const key of required) if (!Object.hasOwn(value, key)) throw new Error(`${label} is missing ${key}.`);
}

function boundedNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a number from ${min} to ${max}.`);
  return value;
}

function boundedString(value: unknown, label: string, max: number, allowEmpty = true): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error(`${label} must be ${allowEmpty ? 'a' : 'a non-empty'} string up to ${max} characters.`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  return value;
}

function parseTemplate(value: unknown): LabelTemplate {
  const input = record(value, 'template');
  exactKeys(input, TEMPLATE_KEYS, 'template', ['widthMm', 'heightMm', 'paddingMm', 'border', 'alignment', 'code', 'fields']);
  const alignment = input.alignment;
  if (!['left', 'center', 'right'].includes(String(alignment))) throw new Error('template.alignment is unsupported.');
  if (input.mode !== undefined && !['asset', 'cable', 'location', 'code'].includes(String(input.mode))) throw new Error('template.mode is unsupported.');
  if (input.textLayout !== undefined && !['standard', 'mirrored'].includes(String(input.textLayout))) throw new Error('template.textLayout is unsupported.');
  const codeInput = record(input.code, 'template.code');
  exactKeys(codeInput, CODE_KEYS, 'template.code', ['type', 'field', 'sizeMm', 'payload', 'barcodeHeightMm', 'barcodeText', 'barcodeTextPosition']);
  if (!['qr', 'code128', 'none'].includes(String(codeInput.type))) throw new Error('template.code.type is unsupported.');
  if (!['top', 'bottom'].includes(String(codeInput.barcodeTextPosition))) throw new Error('template.code.barcodeTextPosition is unsupported.');
  if (codeInput.payloadMode !== undefined && !['text', 'url', 'fieldlens', 'location'].includes(String(codeInput.payloadMode))) throw new Error('template.code.payloadMode is unsupported.');
  const widthMm = boundedNumber(input.widthMm, 'template.widthMm', 10, 200);
  const heightMm = boundedNumber(input.heightMm, 'template.heightMm', 10, 200);
  const paddingMm = boundedNumber(input.paddingMm, 'template.paddingMm', 0, Math.min(widthMm, heightMm) / 3);
  const fieldsInput = input.fields;
  if (!Array.isArray(fieldsInput) || fieldsInput.length > 32) throw new Error('template.fields must contain at most 32 fields.');
  const fields = fieldsInput.map((candidate, index) => {
    const field = record(candidate, `template.fields[${index}]`);
    exactKeys(field, FIELD_KEYS, `template.fields[${index}]`);
    return {
      source: boundedString(field.source, `template.fields[${index}].source`, 200, false),
      label: boundedString(field.label, `template.fields[${index}].label`, 200),
      fontSize: boundedNumber(field.fontSize, `template.fields[${index}].fontSize`, 5, 48),
      bold: boolean(field.bold, `template.fields[${index}].bold`),
    };
  });
  const codeType = codeInput.type as LabelTemplate['code']['type'];
  const codeField = boundedString(codeInput.field, 'template.code.field', 200);
  if (codeType !== 'none' && !codeField.trim()) throw new Error('template.code.field must name a column when a code is enabled.');
  const sizeMm = boundedNumber(codeInput.sizeMm, 'template.code.sizeMm', 0, 100);
  const barcodeHeightMm = boundedNumber(codeInput.barcodeHeightMm, 'template.code.barcodeHeightMm', 0, 100);
  if (codeType === 'qr' && (sizeMm < 8 || sizeMm > Math.min(widthMm, heightMm))) throw new Error(`template.code.sizeMm must be from 8 to ${Math.min(widthMm, heightMm)} for a QR code.`);
  if (codeType === 'code128' && (barcodeHeightMm < 5 || barcodeHeightMm > Math.min(40, heightMm))) throw new Error(`template.code.barcodeHeightMm must be from 5 to ${Math.min(40, heightMm)} for Code 128.`);
  const payload = boundedString(codeInput.payload, 'template.code.payload', 2000);
  if (/[{}]/.test(payload.replace(/\{([^{}]+)\}/g, '')) || [...payload.matchAll(/\{([^{}]+)\}/g)].some((match) => !match[1]?.trim())) {
    throw new Error('template.code.payload must use complete, non-empty {columnName} placeholders.');
  }
  const result: LabelTemplate = {
    widthMm,
    heightMm,
    paddingMm,
    border: boolean(input.border, 'template.border'),
    alignment: alignment as LabelTemplate['alignment'],
    code: {
      type: codeType,
      field: codeField,
      sizeMm,
      payload,
      barcodeHeightMm,
      barcodeText: boolean(codeInput.barcodeText, 'template.code.barcodeText'),
      barcodeTextPosition: codeInput.barcodeTextPosition as 'top' | 'bottom',
      ...(codeInput.barcodeScale === undefined ? {} : { barcodeScale: boundedNumber(codeInput.barcodeScale, 'template.code.barcodeScale', 0.8, 3) }),
      ...(codeInput.payloadMode === undefined ? {} : { payloadMode: codeInput.payloadMode as NonNullable<LabelTemplate['code']['payloadMode']> }),
    },
    fields,
    ...(input.mode === undefined ? {} : { mode: input.mode as NonNullable<LabelTemplate['mode']> }),
    ...(input.textLayout === undefined ? {} : { textLayout: input.textLayout as NonNullable<LabelTemplate['textLayout']> }),
  };
  return result;
}

function parsePage(value: unknown): PageSettings {
  const input = record(value, 'page');
  exactKeys(input, PAGE_KEYS, 'page', ['preset', 'widthMm', 'heightMm', 'marginTopMm', 'marginBottomMm', 'marginLeftMm', 'marginRightMm', 'gapXMm', 'gapYMm']);
  if (!['A4', 'Letter', 'A5', 'Custom'].includes(String(input.preset))) throw new Error('page.preset is unsupported.');
  const result: PageSettings = {
    preset: input.preset as PageSettings['preset'],
    widthMm: boundedNumber(input.widthMm, 'page.widthMm', 50, 500),
    heightMm: boundedNumber(input.heightMm, 'page.heightMm', 50, 700),
    marginTopMm: boundedNumber(input.marginTopMm, 'page.marginTopMm', 0, 100),
    marginBottomMm: boundedNumber(input.marginBottomMm, 'page.marginBottomMm', 0, 100),
    marginLeftMm: boundedNumber(input.marginLeftMm, 'page.marginLeftMm', 0, 100),
    marginRightMm: boundedNumber(input.marginRightMm, 'page.marginRightMm', 0, 100),
    gapXMm: boundedNumber(input.gapXMm, 'page.gapXMm', 0, 50),
    gapYMm: boundedNumber(input.gapYMm, 'page.gapYMm', 0, 50),
    ...(input.offsetXMm === undefined ? {} : { offsetXMm: boundedNumber(input.offsetXMm, 'page.offsetXMm', -50, 50) }),
    ...(input.offsetYMm === undefined ? {} : { offsetYMm: boundedNumber(input.offsetYMm, 'page.offsetYMm', -50, 50) }),
  };
  if (result.marginLeftMm + result.marginRightMm >= result.widthMm) throw new Error('page left and right margins must leave room for labels.');
  if (result.marginTopMm + result.marginBottomMm >= result.heightMm) throw new Error('page top and bottom margins must leave room for labels.');
  return result;
}

function documentBytes(json: string) {
  return new TextEncoder().encode(json).byteLength;
}

export function parseTemplateDocument(json: string): TemplateDocument {
  if (typeof json !== 'string' || documentBytes(json) > MAX_TEMPLATE_DOCUMENT_BYTES) throw new Error('Template document must be 128 KiB or smaller.');
  let parsed: unknown;
  try { parsed = JSON.parse(json) as unknown; } catch { throw new Error('Template file is not valid JSON.'); }
  const input = record(parsed, 'document');
  exactKeys(input, ['version', 'kind', 'name', 'template', 'page'], 'document', ['version', 'kind', 'name', 'template']);
  if (input.version !== TEMPLATE_DOCUMENT_VERSION) throw new Error(`Unsupported template document version: ${String(input.version)}.`);
  if (input.kind !== 'template') throw new Error('This file is not a template document.');
  const name = boundedString(input.name, 'name', MAX_TEMPLATE_NAME_LENGTH, false).trim();
  if (!name) throw new Error('Template name cannot be blank.');
  return { version: 1, kind: 'template', name, template: parseTemplate(input.template), ...(input.page === undefined ? {} : { page: parsePage(input.page) }) };
}

export function serializeTemplateDocument(name: string, template: LabelTemplate, page?: PageSettings): string {
  const document: TemplateDocument = { version: 1, kind: 'template', name: name.trim(), template, ...(page ? { page } : {}) };
  const json = JSON.stringify(document, null, 2);
  if (documentBytes(json) > MAX_TEMPLATE_DOCUMENT_BYTES) throw new Error('Template document must be 128 KiB or smaller.');
  // Run generated documents through the same whitelist and bounds as imported files.
  parseTemplateDocument(json);
  return json;
}

export type TemplateFieldMapping = { template: LabelTemplate; missing: string[] };

/** Maps every imported field reference explicitly; unknown references remain visible as missing. */
export function mapTemplateFields(template: LabelTemplate, columns: readonly string[], mapping: Record<string, string>): TemplateFieldMapping {
  const references = new Set([...(template.code.type === 'none' ? [] : [template.code.field]), ...template.fields.map((field) => field.source), ...[...template.code.payload.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])].filter(Boolean));
  const mappedReference = (reference: string) => {
    const value = Object.hasOwn(mapping, reference) ? mapping[reference] : undefined;
    return typeof value === 'string' && value ? value : reference;
  };
  const missing = [...references].filter((reference) => !columns.includes(mappedReference(reference)));
  const mapped: LabelTemplate = {
    ...template,
    code: {
      ...template.code,
      field: template.code.field ? mappedReference(template.code.field) : '',
      payload: template.code.payload.replace(/\{([^{}]+)\}/g, (_token, field: string) => `{${mappedReference(field)}}`),
    },
    fields: template.fields.map((field) => ({ ...field, source: mappedReference(field.source) })),
  };
  return { template: mapped, missing };
}
