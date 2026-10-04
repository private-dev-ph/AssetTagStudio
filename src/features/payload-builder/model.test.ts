import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE } from '../../types';
import { checkPayload, payloadPreset } from './model';
const record = { id: 'r1', values: { ID: 'A/B ?&' } };
const code = { ...DEFAULT_TEMPLATE.code, field: 'ID', sizeMm: 30 };
describe('payload builder', () => {
  it('uses the same safe encoding and raw contract as print jobs', () => {
    expect(checkPayload(record, { ...code, ...payloadPreset('url', 'ID') }).payload).toBe('https://inventory.example/assets/A%2FB%20%3F%26');
    expect(checkPayload(record, { ...code, ...payloadPreset('raw', 'ID') }).payload).toBe('A/B ?&');
    expect(checkPayload(record, { ...code, ...payloadPreset('structured', 'ID') }).payload).toBe('asset_id=A/B ?&\ntype=asset');
  });
  it('rejects unsafe schemes, absent tokens, dense codes and incompatible FieldLens identifiers', () => {
    expect(() => checkPayload(record, { ...code, payload: 'javascript:alert(1)', payloadMode: 'url' })).toThrow(/HTTP/);
    expect(() => checkPayload(record, { ...code, payload: '{Absent}' })).toThrow(/not a column/);
    expect(() => checkPayload(record, { ...code, ...payloadPreset('fieldlens', 'ID') })).toThrow();
    expect(() => checkPayload({ id: 'r', values: { ID: 'x'.repeat(1500) } }, { ...code, sizeMm: 8 })).toThrow(/dense/);
  });
});
