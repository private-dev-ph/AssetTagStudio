import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE } from '../../types';
import { DEFAULT_PREFERENCES, loadPreferences, parsePreferences, PREFERENCES_KEY, savePreferences } from './store';

describe('local preferences', () => {
  it('uses defaults for missing, malformed, and invalid data', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"theme":"neon","unit":"cm"}')).toEqual(DEFAULT_PREFERENCES);
  });

  it('validates each persisted value independently', () => {
    expect(parsePreferences('{"theme":"dark","unit":"x"}')).toEqual({ ...DEFAULT_PREFERENCES, theme: 'dark', unit: 'mm' });
  });

  it('round-trips valid label and page preferences without row data', () => {
    const value = {
      ...DEFAULT_PREFERENCES,
      template: { ...DEFAULT_PREFERENCES.template, widthMm: 80, code: { ...DEFAULT_PREFERENCES.template.code, field: 'Asset ID', payload: 'https://inventory.test/{Asset ID}', barcodeScale: 1.6 } },
      page: { ...DEFAULT_PREFERENCES.page, preset: 'Custom' as const, widthMm: 300 },
      hiddenFields: ['Location'],
    };
    expect(parsePreferences(JSON.stringify(value))).toEqual(value);
  });

  it('preserves optional specialized label settings and signed sheet offsets', () => {
    const value = { ...DEFAULT_PREFERENCES,
      template: { ...DEFAULT_PREFERENCES.template, mode: 'cable' as const, textLayout: 'mirrored' as const, fields: [{ source: 'Name', label: '', fontSize: 10, bold: true }], code: { ...DEFAULT_PREFERENCES.template.code, type: 'none' as const, field: '', payloadMode: 'text' as const } },
      page: { ...DEFAULT_PREFERENCES.page, offsetXMm: -1.25, offsetYMm: 0.8 },
    };
    expect(parsePreferences(JSON.stringify(value))).toEqual(value);
    expect(parsePreferences(JSON.stringify({ ...value, page: { ...value.page, offsetXMm: 500, offsetYMm: Number.NaN } })).page).toEqual(DEFAULT_PAGE);
  });

  it('replaces out-of-range saved dimensions and code settings with safe defaults', () => {
    const value = parsePreferences(JSON.stringify({ template: { ...DEFAULT_PREFERENCES.template, widthMm: 999, heightMm: -1, paddingMm: 99, code: { ...DEFAULT_PREFERENCES.template.code, sizeMm: 999, barcodeHeightMm: 100, barcodeScale: 9 } }, page: { ...DEFAULT_PREFERENCES.page, widthMm: 0, heightMm: -10 } }));
    expect(value.template.widthMm).toBe(DEFAULT_PREFERENCES.template.widthMm);
    expect(value.template.heightMm).toBe(DEFAULT_PREFERENCES.template.heightMm);
    expect(value.template.paddingMm).toBe(DEFAULT_PREFERENCES.template.paddingMm);
    expect(value.template.code.sizeMm).toBe(DEFAULT_PREFERENCES.template.code.sizeMm);
    expect(value.template.code.barcodeHeightMm).toBe(DEFAULT_PREFERENCES.template.code.barcodeHeightMm);
    expect(value.template.code.barcodeScale).toBe(1);
    expect(value.page.widthMm).toBe(DEFAULT_PREFERENCES.page.widthMm);
    expect(value.page.heightMm).toBe(DEFAULT_PREFERENCES.page.heightMm);
  });

  it('loads and saves without persisting dataset state', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    savePreferences({ ...DEFAULT_PREFERENCES, theme: 'dark', unit: 'in' }, storage);
    expect(loadPreferences(storage)).toEqual({ ...DEFAULT_PREFERENCES, theme: 'dark', unit: 'in' });
    expect([...values.keys()]).toEqual([PREFERENCES_KEY]);
  });

  it('falls back when storage access throws', () => {
    expect(loadPreferences({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_PREFERENCES);
    expect(() => savePreferences(DEFAULT_PREFERENCES, { setItem: () => { throw new Error('blocked'); } })).not.toThrow();
  });
});
