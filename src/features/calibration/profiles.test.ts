import { describe, expect, it } from 'vitest';
import { parsePrinterProfile, readPrinterProfileFile, serializePrinterProfile } from './profiles';

describe('printer profile document', () => {
  it('round-trips settings-only profiles with signed offsets', () => {
    const profile = { id: 'printer-1', name: 'Warehouse Zebra', offsetXMm: -1.25, offsetYMm: 0.75 };
    expect(parsePrinterProfile(serializePrinterProfile(profile))).toEqual(profile);
  });
  it('strictly rejects unknown keys, unsupported versions, and out-of-range offsets', () => {
    expect(() => parsePrinterProfile('{"version":1,"id":"p","name":"P","offsetXMm":0,"offsetYMm":0,"rows":[]}')).toThrow(/unsupported or missing/);
    expect(() => parsePrinterProfile('{"version":2,"id":"p","name":"P","offsetXMm":0,"offsetYMm":0}')).toThrow(/version/);
    expect(() => serializePrinterProfile({ id: 'p', name: 'P', offsetXMm: -100.1, offsetYMm: 0 })).toThrow(/Horizontal calibration/);
    expect(() => parsePrinterProfile('{')).toThrow(/valid JSON/);
  });
  it('checks file size before reading profile contents', async () => {
    const text = async () => { throw new Error('must not read oversized file'); };
    await expect(readPrinterProfileFile({ size: 10_001, text })).rejects.toThrow(/too large/);
    await expect(readPrinterProfileFile({ size: 1, text: async () => serializePrinterProfile({ id: 'p', name: 'Printer', offsetXMm: 0, offsetYMm: 0 }) })).resolves.toContain('"version":1');
  });
});
