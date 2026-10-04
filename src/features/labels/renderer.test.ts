import { describe, expect, it } from 'vitest';
import type { AssetRecord, LabelTemplate } from '../../types';
import { DEFAULT_TEMPLATE } from '../../types';
import { interpolatePayload, validateTemplate, wrapText } from './renderer';

const template: LabelTemplate = {
  ...DEFAULT_TEMPLATE,
  code: { ...DEFAULT_TEMPLATE.code, field: 'Asset ID' },
};
const record: AssetRecord = { id: 'row-1', values: { 'Asset ID': 'A-104', 'Location Name': 'North room' } };

describe('label template and payload', () => {
  it('accepts the default physical size and interpolates headers with spaces', () => {
    validateTemplate(template);
    expect(interpolatePayload(record, { ...template, code: { ...template.code, payload: 'ID={Asset ID}; {Location Name}' } })).toBe('ID=A-104; North room');
  });

  it('reports a missing raw value and unknown placeholder with repair guidance', () => {
    expect(() => interpolatePayload({ id: 'empty', values: {} }, template)).toThrow(/no value.*choose another code column/i);
    expect(() => interpolatePayload(record, { ...template, code: { ...template.code, payload: '{Missing column}' } })).toThrow(/not a column.*Fix the template/i);
    expect(() => interpolatePayload({ ...record, values: { ...record.values, 'Location Name': '' } }, { ...template, code: { ...template.code, payload: 'loc={Location Name}' } })).toThrow(/no value.*Fill that cell/i);
  });

  it('uses only own string properties for code values, including special column names', () => {
    expect(() => interpolatePayload(record, { ...template, code: { ...template.code, payload: '{toString}' } })).toThrow(/not a column/);
    const values = Object.create(null) as Record<string, string>;
    values.__proto__ = 'own prototype column';
    const specialRecord: AssetRecord = { id: 'special', values };
    expect(interpolatePayload(specialRecord, { ...template, code: { ...template.code, field: '__proto__' } })).toBe('own prototype column');
    expect(interpolatePayload(specialRecord, { ...template, code: { ...template.code, payload: '{__proto__}' } })).toBe('own prototype column');
  });

  it('rejects non-finite and oversized render settings', () => {
    expect(() => validateTemplate({ ...template, widthMm: Number.POSITIVE_INFINITY })).toThrow(/Label width/);
    expect(() => validateTemplate({ ...template, fields: [{ source: 'Name', label: 'Name', fontSize: 500, bold: false }] })).toThrow(/font size/);
    expect(() => validateTemplate({ ...template, paddingMm: 11 })).toThrow(/Padding/);
    expect(() => validateTemplate({ ...template, code: { ...template.code, barcodeHeightMm: 500, type: 'code128' } })).toThrow(/Barcode height/);
    expect(() => validateTemplate({ ...template, code: { ...template.code, type: 'code128', barcodeScale: 3.1 } })).toThrow(/Barcode scale/);
    expect(() => validateTemplate({ ...template, code: { ...template.code, type: 'code128', barcodeScale: Number.NaN } })).toThrow(/Barcode scale/);
    expect(() => validateTemplate({ ...template, code: { ...template.code, payload: '{Nested {Name}}' } })).toThrow(/placeholders must use/);
    expect(() => validateTemplate({ ...template, code: { ...template.code, payload: '{' } })).toThrow(/placeholders must use/);
    expect(() => interpolatePayload(record, { ...template, code: { ...template.code, payload: `${'x'.repeat(2_001)}` } })).toThrow(/2,000 characters/);
    expect(() => interpolatePayload({ id: 'long', values: { 'Asset ID': 'x'.repeat(2_001) } }, template)).toThrow(/code value over 2,000/);
    expect(() => validateTemplate({ ...template, fields: [{ source: 42 as unknown as string, label: 'Name', fontSize: 10, bold: false }] })).toThrow(/source column name/);
  });

  it('wraps at words and splits long unbroken values by measured width', () => {
    const wrapped = wrapText('alpha beta ABCDE', 5, (value) => value.length);
    expect(wrapped).toEqual(['alpha', 'beta', 'ABCDE']);
    expect(wrapText('ABCDEFGHI', 4, (value) => value.length)).toEqual(['ABCD', 'EFGH', 'I']);
  });

  it('rejects text areas narrower than a glyph without distorting text', () => {
    expect(() => wrapText('W', 3, () => 4)).toThrow(/Reduce the font size/);
    expect(() => wrapText('a', 0, () => 1)).toThrow(/positive width/);
    expect(() => wrapText('a', Number.NaN, () => 1)).toThrow(/positive width/);
  });
});
