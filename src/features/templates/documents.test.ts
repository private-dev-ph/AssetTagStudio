import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE, DEFAULT_TEMPLATE } from '../../types';
import { mapTemplateFields, parseTemplateDocument, serializeTemplateDocument } from './documents';

describe('template documents', () => {
  it('round trips a settings-only version 1 document without changing its input', () => {
    const source = structuredClone(DEFAULT_TEMPLATE);
    const json = serializeTemplateDocument('Receiving', source, DEFAULT_PAGE);
    expect(parseTemplateDocument(json)).toEqual({ version: 1, kind: 'template', name: 'Receiving', template: source, page: DEFAULT_PAGE });
    expect(source).toEqual(DEFAULT_TEMPLATE);
  });

  it('accepts supported optional print contracts without inserting defaults', () => {
    const document = { version: 1, kind: 'template', name: 'Cable', template: { ...DEFAULT_TEMPLATE, mode: 'cable', textLayout: 'mirrored', code: { ...DEFAULT_TEMPLATE.code, type: 'none' } } };
    expect(parseTemplateDocument(JSON.stringify(document)).template).toEqual(document.template);
    const legacy = JSON.parse(serializeTemplateDocument('Legacy', DEFAULT_TEMPLATE)) as Record<string, unknown>;
    const template = legacy.template as Record<string, unknown>;
    delete template.mode;
    delete template.textLayout;
    const code = template.code as Record<string, unknown>;
    delete code.payloadMode;
    delete code.barcodeScale;
    expect(parseTemplateDocument(JSON.stringify(legacy)).template).not.toHaveProperty('mode');
  });

  it('rejects unknown, row-bearing, malformed, future-version, and oversized documents', () => {
    const base = JSON.parse(serializeTemplateDocument('Valid', DEFAULT_TEMPLATE)) as Record<string, unknown>;
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, extra: true }))).toThrow(/unsupported property/i);
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, records: [{ id: '1', values: { asset: 'x' } }] }))).toThrow(/unsupported property/i);
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, version: 2 }))).toThrow(/version/i);
    expect(() => parseTemplateDocument(JSON.stringify({ ...base, template: { ...(base.template as object), unsafe: 'value' } }))).toThrow(/unsupported property/i);
    expect(() => parseTemplateDocument('{')).toThrow(/valid json/i);
    expect(() => parseTemplateDocument(' '.repeat(128 * 1024 + 1))).toThrow(/128 kib/i);
  });

  it('maps each source explicitly and preserves unmapped references and source objects', () => {
    const source = { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'Serial', payload: 'asset:{Asset ID}' }, fields: [{ source: 'Name', label: 'Device', fontSize: 8, bold: false }] };
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
});
