import type { AssetRecord, LabelTemplate } from '../types';
import { readValue } from './dataset';

const TOKEN = /\{([^{}]+)\}/g;
const hasControl = (value: string) => Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
export const MAX_PAYLOAD_LENGTH = 2000;
export function payloadReferences(pattern: string): string[] {
  if (typeof pattern !== 'string' || pattern.length > MAX_PAYLOAD_LENGTH) throw new Error('Code payload must be text with no more than 2,000 characters.');
  if (/[{}]/.test(pattern.replace(TOKEN, '')) || [...pattern.matchAll(TOKEN)].some(m => !m[1].trim())) throw new Error('Payload placeholders must use the form {columnName}.');
  return [...new Set([...pattern.matchAll(TOKEN)].map(m => m[1]))];
}
export function validatePayloadUri(payload: string, mode: NonNullable<LabelTemplate['code']['payloadMode']>): void {
  if (mode === 'text') return;
  if (/\s/.test(payload) || hasControl(payload)) throw new Error('URI payloads cannot contain literal whitespace or control characters.');
  try { decodeURI(payload); } catch { throw new Error('URI contains malformed percent encoding.'); }
  if (payload.split(/[/?#]/).some(segment => { try { return ['.', '..'].includes(decodeURIComponent(segment)); } catch { return true; } })) throw new Error('URI cannot contain traversal segments.');
  let uri: URL;
  try { uri = new URL(payload); } catch { throw new Error('The payload is not a valid absolute URI.'); }
  if (mode === 'url') {
    if (!['https:', 'http:'].includes(uri.protocol) || !uri.hostname || uri.username || uri.password) throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
  } else {
    const scheme = mode === 'fieldlens' ? 'fieldlens:' : 'location:';
    if (uri.protocol !== scheme || !uri.hostname || uri.port || uri.search || uri.hash || uri.username || uri.password) throw new Error(`Use a valid ${mode} URI without credentials, port, query or fragment.`);
    // FieldLens's current mobile resolver explicitly rejects percent-encoded IDs.
    if (mode === 'fieldlens' && (uri.hostname.toLowerCase() !== 'asset' || !/^fieldlens:\/\/asset\/[^/\\?#%]+$/i.test(payload))) throw new Error('FieldLens URI needs one unescaped identifier: no %, slash, whitespace, query or fragment.');
    const parts = [uri.hostname, ...uri.pathname.split('/').filter(Boolean)];
    if (mode === 'location' && uri.pathname.endsWith('/')) throw new Error('Location hierarchy cannot end with an empty segment.');
    for (const part of parts) {
      let decoded: string;
      try { decoded = decodeURIComponent(part); } catch { throw new Error('URI contains malformed percent encoding.'); }
      if (!decoded.trim() || hasControl(decoded) || decoded === '.' || decoded === '..') throw new Error('URI segments need nonempty values without control characters or traversal segments.');
    }
  }
}
export function resolveCodePayload(record: AssetRecord, code: LabelTemplate['code']): string {
  if (code.type === 'none') return '';
  const refs = payloadReferences(code.payload);
  let result: string;
  if (!code.payload) {
    result = readValue(record, code.field);
    if (!result.trim()) throw new Error(`Record “${record.id}” has no value in “${code.field}”. Fill that cell or choose another code column.`);
  } else {
    for (const key of refs) {
      if (!Object.hasOwn(record.values, key)) throw new Error(`Payload placeholder “{${key}}” is not a column in the records. Fix the template placeholder.`);
      if (!readValue(record, key).trim()) throw new Error(`Record “${record.id}” has no value in “${key}”. Fill that cell or change the payload.`);
    }
    const encode = code.payloadMode === 'url' || code.payloadMode === 'location';
    result = code.payload.replace(TOKEN, (_, key: string) => encode ? encodeURIComponent(readValue(record, key)) : readValue(record, key));
  }
  if (!result.trim()) throw new Error('The code payload is empty.');
  if (result.length > MAX_PAYLOAD_LENGTH) throw new Error(`Record “${record.id}” produces a code value over 2,000 characters.`);
  validatePayloadUri(result, code.payloadMode ?? 'text');
  return result;
}
