import { expect, it } from 'vitest';
import { DEFAULT_TEMPLATE } from '../types';
import { resolveCodePayload, validatePayloadUri } from './payload';

it('matches the existing FieldLens single unescaped case-sensitive identifier contract', () => {
  validatePayloadUri('FIELDLENS://ASSET/AST-CTRL-0042', 'fieldlens');
  const code = { ...DEFAULT_TEMPLATE.code, field: 'ID', payload: 'fieldlens://asset/{ID}', payloadMode: 'fieldlens' as const };
  expect(resolveCodePayload({ id: '1', values: { ID: 'PC-001' } }, code)).toBe('fieldlens://asset/PC-001');
  for (const id of ['A/B', 'A B', '%2F', 'A?B', 'A\\B', '..']) expect(() => resolveCodePayload({ id: '1', values: { ID: id } }, code)).toThrow();
});
