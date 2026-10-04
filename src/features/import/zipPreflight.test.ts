import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { preflightXlsxZip } from './zipPreflight';
import { parseWorkbook } from './parser';

type Entry = {
  name: string;
  method?: number;
  flags?: number;
  localMethod?: number;
  localFlags?: number;
  localName?: string;
  compressedSize?: number;
  uncompressedSize?: number;
  localCompressedSize?: number;
  localUncompressedSize?: number;
  crc?: number;
  localCrc?: number;
  extra?: Uint8Array;
  localExtra?: Uint8Array;
  offsetOverride?: number;
};

function write16(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer).setUint16(offset, value, true);
}
function write32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer).setUint32(offset, value, true);
}
function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function makeZip(entries: Entry[], comment = new Uint8Array()): ArrayBuffer {
  const localParts: Uint8Array[] = [];
  const localOffsets: number[] = [];
  let localLength = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.localName ?? entry.name);
    const localExtra = entry.localExtra ?? new Uint8Array();
    const comp = entry.compressedSize ?? 0;
    const uncomp = entry.uncompressedSize ?? comp;
    const method = entry.method ?? 0;
    const flags = entry.flags ?? 0;
    const crc = entry.crc ?? 0;
    const local = new Uint8Array(30 + name.length + localExtra.length + comp);
    write32(local, 0, 0x04034b50);
    write16(local, 4, 20);
    write16(local, 6, entry.localFlags ?? flags);
    write16(local, 8, entry.localMethod ?? method);
    write32(local, 14, entry.localCrc ?? crc);
    write32(local, 18, entry.localCompressedSize ?? comp);
    write32(local, 22, entry.localUncompressedSize ?? uncomp);
    write16(local, 26, name.length);
    write16(local, 28, localExtra.length);
    local.set(name, 30);
    local.set(localExtra, 30 + name.length);
    localOffsets.push(localLength);
    localParts.push(local);
    localLength += local.length;
  }

  const centralParts: Uint8Array[] = [];
  let centralLength = 0;
  entries.forEach((entry, index) => {
    const name = new TextEncoder().encode(entry.name);
    const extra = entry.extra ?? new Uint8Array();
    const comp = entry.compressedSize ?? 0;
    const uncomp = entry.uncompressedSize ?? comp;
    const method = entry.method ?? 0;
    const flags = entry.flags ?? 0;
    const crc = entry.crc ?? 0;
    const central = new Uint8Array(46 + name.length + extra.length);
    write32(central, 0, 0x02014b50);
    write16(central, 4, 20);
    write16(central, 6, 20);
    write16(central, 8, flags);
    write16(central, 10, method);
    write32(central, 16, crc);
    write32(central, 20, comp);
    write32(central, 24, uncomp);
    write16(central, 28, name.length);
    write16(central, 30, extra.length);
    write16(central, 32, 0);
    write16(central, 34, 0);
    write32(central, 38, 0);
    write32(central, 42, entry.offsetOverride ?? localOffsets[index]);
    central.set(name, 46);
    central.set(extra, 46 + name.length);
    centralParts.push(central);
    centralLength += central.length;
  });

  const localDirectory = concatBytes(localParts);
  const centralDirectory = concatBytes(centralParts);
  const eocd = new Uint8Array(22 + comment.length);
  write32(eocd, 0, 0x06054b50);
  write16(eocd, 4, 0);
  write16(eocd, 6, 0);
  write16(eocd, 8, entries.length);
  write16(eocd, 10, entries.length);
  write32(eocd, 12, centralLength);
  write32(eocd, 16, localDirectory.length);
  write16(eocd, 20, comment.length);
  eocd.set(comment, 22);
  return concatBytes([localDirectory, centralDirectory, eocd]).buffer as ArrayBuffer;
}

function issue(entries: Entry[]): string {
  try { preflightXlsxZip(makeZip(entries)); }
  catch (error) { return error instanceof Error ? error.message : String(error); }
  throw new Error('Expected ZIP preflight to reject the archive.');
}

describe('XLSX ZIP preflight', () => {
  it('accepts a standard compressed SheetJS workbook and imports its sheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['id'], ['001']]), 'Assets');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
    preflightXlsxZip(buffer);
    expect(parseWorkbook(buffer, 'Assets').records[0].values.id).toBe('001');
  });

  it('rejects missing EOCD and trailing archive data', () => {
    const valid = new Uint8Array(makeZip([{ name: 'a', compressedSize: 1 }]));
    expect(() => preflightXlsxZip(valid.slice(0, -1).buffer)).toThrow(/end-of-central-directory/);
    expect(() => preflightXlsxZip(concatBytes([valid, new Uint8Array([0])]).buffer as ArrayBuffer)).toThrow(/end-of-central-directory/);
    const forgedRecord = new Uint8Array(22);
    write32(forgedRecord, 0, 0x06054b50);
    expect(() => preflightXlsxZip(makeZip([{ name: 'a' }], forgedRecord))).toThrow(/archive comments are not supported/);
  });

  it('rejects mismatched local sizes, CRC, flags, methods, and names', () => {
    expect(issue([{ name: 'a', compressedSize: 1, uncompressedSize: 1, localUncompressedSize: 2 }])).toMatch(/CRC or size fields differ/);
    expect(issue([{ name: 'a', compressedSize: 1, crc: 1, localCrc: 2 }])).toMatch(/CRC or size fields differ/);
    expect(issue([{ name: 'a', compressedSize: 1, flags: 0x0800, localFlags: 0 }])).toMatch(/flags or compression methods differ/);
    expect(issue([{ name: 'a', method: 8, localMethod: 0, compressedSize: 1, uncompressedSize: 1 }])).toMatch(/flags or compression methods differ/);
    expect(issue([{ name: 'a', localName: 'b' }])).toMatch(/member names differ/);
  });

  it('rejects forged expansion, per-member, total, entry-count, and ratio limits', () => {
    const memberUncompressed = 16 * 1024 * 1024 + 1;
    expect(issue([{ name: 'large', method: 8, compressedSize: 17_000, uncompressedSize: memberUncompressed }])).toMatch(/per-member/);
    const totals = Array.from({ length: 5 }, (_, index) => ({ name: `f${index}`, method: 8, compressedSize: 14_000, uncompressedSize: 13 * 1024 * 1024 }));
    expect(issue(totals)).toMatch(/total uncompressed/);
    expect(issue(Array.from({ length: 2_049 }, (_, index) => ({ name: `f${index}` })))).toMatch(/more than 2048 entries/);
    expect(issue([{ name: 'ratio', method: 8, compressedSize: 1_000, uncompressedSize: 1_000_001 }])).toMatch(/expansion ratio/);
  });

  it('rejects ZIP64, data descriptors, duplicate offsets, and zero-sized deflate declarations', () => {
    const zip64 = new Uint8Array([1, 0, 0, 0]);
    expect(issue([{ name: 'zip64', extra: zip64 }])).toMatch(/ZIP64/);
    expect(issue([{ name: 'zip64-local', localExtra: zip64 }])).toMatch(/ZIP64/);
    expect(issue([{ name: 'stream', flags: 8, compressedSize: 2, uncompressedSize: 4 }])).toMatch(/data descriptors/);
    expect(issue([{ name: 'one' }, { name: 'two', offsetOverride: 0 }])).toMatch(/overlap/);
    expect(issue([{ name: 'empty-deflate', method: 8, compressedSize: 1, uncompressedSize: 0 }])).toMatch(/unknown or zero local uncompressed/);
  });

  it('rejects stored size mismatches, unsupported methods, and malformed/truncated central records', () => {
    expect(issue([{ name: 'stored', compressedSize: 1, uncompressedSize: 2 }])).toMatch(/stored member/);
    expect(issue([{ name: 'other', method: 12, compressedSize: 1, uncompressedSize: 1 }])).toMatch(/compression method 12/);
    const bytes = new Uint8Array(makeZip([{ name: 'a' }]));
    const central = bytes.findIndex((_, index) => index + 4 <= bytes.length && new DataView(bytes.buffer).getUint32(index, true) === 0x02014b50);
    bytes[central] = 0;
    expect(() => preflightXlsxZip(bytes.buffer)).toThrow(/central directory entry/);
  });
});
