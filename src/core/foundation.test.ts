import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE, type Dataset } from '../types';
import { UndoHistory, cloneValues, readValue, validateDataset } from './dataset';
import { csvText } from './download';
import { resolveCodePayload, validatePayloadUri } from './payload';

const dataset: Dataset = { columns: ['ID'], records: [{ id: 'row-1', values: { ID: 'A/B ?&' } }], warnings: [] };
const code = { ...DEFAULT_TEMPLATE.code, field: 'ID' };
describe('expansion foundation', () => {
  it('retains stable identities and rejects invalid working datasets', () => {
    validateDataset(dataset);
    expect(() => validateDataset({ ...dataset, records: [...dataset.records, dataset.records[0]] })).toThrow(/identities/);
    expect(() => validateDataset({ ...dataset, columns: ['ID', 'ID'] })).toThrow(/unique/);
    expect(() => validateDataset({ ...dataset, records: [{ id: 'x', values: {} }] })).toThrow(/Invalid/);
  });
  it('reads own properties and safely clones special column names', () => {
    expect(readValue({ id: 'x', values: {} }, 'toString')).toBe('');
    const values = Object.create(null); values.__proto__ = 'actual';
    expect(readValue({ id: 'x', values: cloneValues(values) }, '__proto__')).toBe('actual');
  });
  it('bounds undo memory/history and restores snapshots in order', () => {
    const undo = new UndoHistory<number>(v => v, 10, 2);
    undo.push(2, 'first'); undo.push(3, 'second'); undo.push(4, 'third');
    expect(undo.pop()).toBe(4); expect(undo.pop()).toBe(3); expect(undo.canUndo).toBe(false);
    expect(() => undo.push(11, 'oversized')).toThrow(/undo limit/);
    undo.push(1, 'reset'); undo.clear(); expect(undo.pop()).toBeUndefined();
  });
  it('preserves legacy raw/text payloads but encodes URL token values', () => {
    expect(resolveCodePayload(dataset.records[0], code)).toBe('A/B ?&');
    expect(resolveCodePayload(dataset.records[0], { ...code, payload: 'https://example.invalid/assets/{ID}', payloadMode: 'url' })).toBe('https://example.invalid/assets/A%2FB%20%3F%26');
    expect(resolveCodePayload(dataset.records[0], { ...code, payload: 'ID:{ID}' })).toBe('ID:A/B ?&');
    expect(resolveCodePayload(dataset.records[0], { ...code, type: 'none', field: '' })).toBe('');
  });
  it('rejects malformed and unsafe URI modes, absent values and oversized output', () => {
    for (const value of ['javascript:alert(1)', 'https://user:pass@example.invalid', 'not a url']) expect(() => validatePayloadUri(value, 'url')).toThrow();
    for (const value of ['fieldlens://other/A', 'fieldlens://asset/A/B', 'fieldlens://asset/%XX', 'fieldlens://asset/A?x=1']) expect(() => validatePayloadUri(value, 'fieldlens')).toThrow();
    expect(() => resolveCodePayload(dataset.records[0], { ...code, payload: '{Missing}' })).toThrow(/not a column/);
    expect(() => resolveCodePayload(dataset.records[0], { ...code, payload: '{{ID}}' })).toThrow(/placeholders/);
    expect(() => resolveCodePayload(dataset.records[0], { ...code, payload: 'x'.repeat(2001) })).toThrow(/2,000/);
    validatePayloadUri('fieldlens://asset/PC-001', 'fieldlens');
    validatePayloadUri('location://warehouse-a/rack-a/bin-07', 'location');
    expect(() => validatePayloadUri('location://warehouse-a//bin-07', 'location')).toThrow(/empty segment/);
  });
  it('quotes CSV content and neutralizes spreadsheet formula prefixes', () => {
    expect(csvText([['=HYPERLINK("x")', 'a,b', 'A-1']])).toContain('"\'=HYPERLINK(""x"")"');
    expect(csvText([[' a', '+123']])).toBe('" a","\'+123"\r\n');
  });
});
