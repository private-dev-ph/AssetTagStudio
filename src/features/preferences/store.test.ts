import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, loadPreferences, parsePreferences, PREFERENCES_KEY, savePreferences } from './store';

describe('local preferences', () => {
  it('uses defaults for missing, malformed, and invalid data', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"theme":"neon","unit":"cm"}')).toEqual(DEFAULT_PREFERENCES);
  });

  it('validates each persisted value independently', () => {
    expect(parsePreferences('{"theme":"dark","unit":"x"}')).toEqual({ theme: 'dark', unit: 'mm' });
  });

  it('loads and saves without persisting dataset state', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    savePreferences({ theme: 'dark', unit: 'in' }, storage);
    expect(loadPreferences(storage)).toEqual({ theme: 'dark', unit: 'in' });
    expect([...values.keys()]).toEqual([PREFERENCES_KEY]);
  });

  it('falls back when storage access throws', () => {
    expect(loadPreferences({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_PREFERENCES);
    expect(() => savePreferences(DEFAULT_PREFERENCES, { setItem: () => { throw new Error('blocked'); } })).not.toThrow();
  });
});
