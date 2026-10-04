import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE, DEFAULT_TEMPLATE } from '../../types';
import { mapTemplateFields, parseTemplateDocument, serializeTemplateDocument } from './documents';
import { BUILT_IN_TEMPLATES } from '../../studio/pages/TemplatesPage';

const VALID_TEMPLATE = { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'Asset ID' } };

describe('template documents', () => {
  it('preserves all seven hierarchy fields within the renderer bounds', () => {
    const fields = ['Site', 'Building', 'Floor', 'Room', 'Rack', 'Shelf', 'Bin'].map(source => ({ source, label: source, fontSize: 14, bold: true }));
    const template = { ...VALID_TEMPLATE, heightMm: 80, fields };
    expect(parseTemplateDocument(serializeTemplateDocument('Hierarchy', template)).template.fields).toEqual(fields);
    expect(() => serializeTemplateDocument('Too many', { ...template, fields: Array.from({ length: 33 }, () => fields[0]) })).toThrow(/32 fields/);
  });
  it('round trips a settings-only version 1 document without changing its input', () => {
    const source = structuredClone(VALID_TEMPLATE);
    const json = serializeTemplateDocument('Receiving', source, DEFAULT_PAGE);
    expect(parseTemplateDocument(json)).toEqual({ version: 1, kind: 'template', name: 'Receiving', template: source, page: DEFAULT_PAGE });
    expect(source).toEqual(VALID_TEMPLATE);
  });

  it('accepts supported optional print contracts without inserting defaults', () => {
    const document = { version: 1, kind: 'template', name: 'Cable', template: { ...VALID_TEMPLATE, mode: 'cable', textLayout: 'mirrored', code: { ...VALID_TEMPLATE.code, type: 'none' } } };
    expect(parseTemplateDocument(JSON.stringify(document)).template).toEqual(document.template);
    const legacy = JSON.parse(serializeTemplateDocument('Legacy', VALID_TEMPLATE)) as Record<string, unknown>;
    const template = legacy.template as Record<string, unknown>;
    delete template.mode;
    delete template.textLayout;
    const code = template.code as Record<string, unknown>;
    delete code.payloadMode;
    delete code.barcodeScale;
    expect(parseTemplateDocument(JSON.stringify(legacy)).template).not.toHaveProperty('mode');
  });

  it('rejects unknown, row-bearing, malformed, future-version, and oversized documents', () => {
    const base = JSON.parse(serializeTemplateDocument('Valid', VALID_TEMPLATE)) as Record<string, unknown>;
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, extra: true }))).toThrow(/unsupported property/i);
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, records: [{ id: '1', values: { asset: 'x' } }] }))).toThrow(/unsupported property/i);
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, version: 2 }))).toThrow(/version/i);
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, template: { ...(base.template as object), unsafe: 'value' } }))).toThrow(/unsupported property/i);
    expect(() => parseTemplateDocument('{')).toThrow(/valid json/i);
    expect(() => parseTemplateDocument(' '.repeat(128 * 1024 + 1))).toThrow(/128 kib/i);
  });

  it('rejects out-of-range numeric settings, impossible dimensions, and malformed payload tokens', () => {
    const makeDocument = (templatePatch: Record<string, unknown>, pagePatch?: Record<string, unknown>) => {
      const template = { ...VALID_TEMPLATE, ...templatePatch };
      const page = { ...DEFAULT_PAGE, ...pagePatch };
      return JSON.stringify({ version: 1, kind: 'template', name: 'Invalid', template, page });
    };
    expect(() => parseTemplateDocument(makeDocument({ paddingMm: 11 }))).toThrow(/paddingmm/i);
    expect(() => parseTemplateDocument(makeDocument({ code: { ...VALID_TEMPLATE.code, sizeMm: 31 } }))).toThrow(/sizeMm/i);
    expect(() => parseTemplateDocument(makeDocument({ code: { ...VALID_TEMPLATE.code, field: ' ' } }))).toThrow(/field/i);
    expect(() => parseTemplateDocument(makeDocument({ code: { ...VALID_TEMPLATE.code, payload: 'tag:{Asset ID' } }))).toThrow(/placeholders/i);
    expect(() => parseTemplateDocument(makeDocument({}, { widthMm: 100, marginLeftMm: 60, marginRightMm: 50 }))).toThrow(/margins/i);
  });

  it('maps each source explicitly and preserves unmapped references and source objects', () => {
    const source = { ...VALID_TEMPLATE, code: { ...VALID_TEMPLATE.code, field: 'Serial', payload: 'asset:{Asset ID}' }, fields: [{ source: 'Name', label: 'Device', fontSize: 8, bold: false }] };
    const mapping = { Serial: 'S/N', 'Asset ID': 'Tag', Name: 'Device Name' };
    const result = mapTemplateFields(source, ['S/N', 'Tag', 'Device Name'], mapping);
    expect(result.missing).toEqual([]);
    expect(result.template.code).toMatchObject({ field: 'S/N', payload: 'asset:{Tag}' });
    expect(result.template.fields[0].source).toBe('Device Name');
    expect(source.code.field).toBe('Serial');
    const incomplete = mapTemplateFields(source, ['S/N'], { Serial: 'S/N' });
    expect(incomplete.missing).toEqual(['Name', 'Asset ID']);
    expect(incomplete.template.fields[0].source).toBe('Name');
  });

  it('maps hostile property names as ordinary dataset column names', () => {
    const source = {
      ...VALID_TEMPLATE,
      code: { ...VALID_TEMPLATE.code, field: '__proto__', payload: '{constructor}:{toString}' },
      fields: [{ source: 'toString', label: '', fontSize: 8, bold: false }],
    };
    const mapping = Object.create(null) as Record<string, string>;
    mapping.__proto__ = 'Asset Key';
    mapping['constructor'] = 'Serial';
    mapping['toString'] = 'Display Name';
    const result = mapTemplateFields(source, ['Asset Key', 'Serial', 'Display Name'], mapping);
    expect(result.missing).toEqual([]);
    expect(result.template.code.field).toBe('Asset Key');
    expect(result.template.code.payload).toBe('{Serial}:{Display Name}');
    expect(result.template.fields[0].source).toBe('Display Name');
  });

  it('serializes and maps every built-in preset, omitting the unused code field for no-code labels', () => {
    for (const item of BUILT_IN_TEMPLATES) {
      const json = serializeTemplateDocument(item.name, item.template, item.page);
      expect(parseTemplateDocument(json).template).toEqual(item.template);
      const refs = [...new Set([...(item.template.code.type === 'none' ? [] : [item.template.code.field]), ...item.template.fields.map((field) => field.source), ...[...item.template.code.payload.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])].filter(Boolean))];
      expect(mapTemplateFields(item.template, refs, {}).missing).toEqual([]);
      if (item.template.code.type === 'none') expect(refs).not.toContain(item.template.code.field);
    }
  });
});
