import QRCode from 'qrcode';
import type { AssetRecord, LabelTemplate } from '../../types';
import { resolveCodePayload } from '../../core/payload';

export type PayloadCheck = { payload: string; length: number; modules: number; moduleMm: number; warning: string };
export function checkPayload(record: AssetRecord, code: LabelTemplate['code']): PayloadCheck {
  const payload = resolveCodePayload(record, { ...code, type: 'qr' });
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const modules = qr.modules.size + 8;
  const moduleMm = code.sizeMm / modules;
  if (!Number.isFinite(moduleMm) || moduleMm < 0.2) throw new Error('The QR payload is too dense for this code size. Increase the QR size or shorten the payload.');
  return { payload, length: payload.length, modules, moduleMm, warning: moduleMm < 0.3 ? 'Small modules: test a printed label with the actual scanner before printing the batch.' : '' };
}
export function payloadPreset(kind: 'raw' | 'text' | 'url' | 'fieldlens' | 'structured', column: string): Pick<LabelTemplate['code'], 'payload' | 'payloadMode'> {
  if (kind === 'raw') return { payload: '', payloadMode: 'text' };
  if (kind === 'url') return { payload: `https://inventory.example/assets/{${column}}`, payloadMode: 'url' };
  if (kind === 'fieldlens') return { payload: `fieldlens://asset/{${column}}`, payloadMode: 'fieldlens' };
  return { payload: kind === 'structured' ? `asset_id={${column}}\ntype=asset` : `Asset: {${column}}`, payloadMode: 'text' };
}
