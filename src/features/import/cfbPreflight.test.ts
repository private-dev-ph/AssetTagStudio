import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { preflightXlsCfb } from './cfbPreflight';
import { parseWorkbook } from './parser';

const EOC = 0xfffffffe;
const FAT = 0xfffffffd;
const FREE = 0xffffffff;

type Stream = { start: number; size: number };
type TreeOverride = { index: number; type?: number; left?: number; right?: number; child?: number };
function writeName(view: DataView, offset: number, name: string): void {
  for (let index = 0; index < name.length; index += 1) view.setUint16(offset + index * 2, name.charCodeAt(index), true);
  view.setUint16(offset + name.length * 2, 0, true);
  view.setUint16(offset + 64, (name.length + 1) * 2, true);
}
function makeCfb(options: { sectorCount?: number; fatOverrides?: Map<number, number>; streams?: Stream[]; miniStream?: Stream; miniFatValues?: number[]; treeOverrides?: TreeOverride[]; badNameLengths?: Map<number, number>; rootSize?: number; major?: number; byteOrder?: number; fatCount?: number; difatCount?: number } = {}): ArrayBuffer {
  const major = options.major ?? 3;
  const sectorSize = major === 4 ? 4096 : 512;
  const needsMiniFat = Boolean(options.miniStream || options.rootSize);
  const sectorCount = options.sectorCount ?? Math.max(3, (options.streams?.length ?? 0) > 3 ? 4 : 3, needsMiniFat ? 4 : 3);
  const bytes = new Uint8Array(sectorSize * (sectorCount + 1));
  const view = new DataView(bytes.buffer);
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  view.setUint16(24, 0x003e, true);
  view.setUint16(26, major, true);
  view.setUint16(28, options.byteOrder ?? 0xfffe, true);
  view.setUint16(30, major === 4 ? 12 : 9, true);
  view.setUint16(32, 6, true);
  view.setUint32(40, major === 4 ? 1 : 0, true);
  view.setUint32(44, options.fatCount ?? 1, true);
  view.setUint32(48, 1, true);
  view.setUint32(56, 4096, true);
  view.setUint32(60, needsMiniFat ? 3 : EOC, true);
  view.setUint32(64, needsMiniFat ? 1 : 0, true);
  view.setUint32(68, EOC, true);
  view.setUint32(72, options.difatCount ?? 0, true);
  for (let index = 0; index < 109; index += 1) view.setUint32(76 + index * 4, FREE, true);
  view.setUint32(76, 0, true);

  const fatStart = sectorSize;
  for (let i = 0; i < sectorSize / 4; i += 1) view.setUint32(fatStart + i * 4, FREE, true);
  view.setUint32(fatStart, FAT, true);
  view.setUint32(fatStart + 4, (options.streams?.length ?? 0) > 3 ? 2 : EOC, true);
  if (sectorCount > 2) view.setUint32(fatStart + 8, EOC, true);
  if (needsMiniFat && sectorCount > 3) view.setUint32(fatStart + 12, EOC, true);
  for (const [sector, next] of options.fatOverrides ?? []) view.setUint32(fatStart + sector * 4, next, true);

  const directoryStart = sectorSize * 2;
  const directorySectorCount = (options.streams?.length ?? 0) > 3 ? 2 : 1;
  for (let index = 0; index < directorySectorCount * sectorSize / 128; index += 1) {
    const offset = directoryStart + index * 128;
    view.setUint32(offset + 68, FREE, true);
    view.setUint32(offset + 72, FREE, true);
    view.setUint32(offset + 76, FREE, true);
  }
  view.setUint8(directoryStart + 66, 5);
  writeName(view, directoryStart, 'Root Entry');
  view.setUint32(directoryStart + 116, options.rootSize ? 2 : EOC, true);
  view.setUint32(directoryStart + 120, options.rootSize ?? 0, true);
  view.setUint32(directoryStart + 124, 0, true);
  (options.streams ?? []).forEach((stream, index) => {
    const offset = directoryStart + (index + 1) * 128;
    view.setUint8(offset + 66, 2);
    writeName(view, offset, `Stream${index}`);
    view.setUint32(offset + 116, stream.start, true);
    view.setUint32(offset + 120, stream.size, true);
    view.setUint32(offset + 124, 0, true);
  });
  if (options.miniStream) {
    const offset = directoryStart + ((options.streams?.length ?? 0) + 1) * 128;
    view.setUint8(offset + 66, 2);
    writeName(view, offset, 'MiniStream');
    view.setUint32(offset + 116, options.miniStream.start, true);
    view.setUint32(offset + 120, options.miniStream.size, true);
    view.setUint32(offset + 124, 0, true);
  }
  for (const override of options.treeOverrides ?? []) {
    const offset = directoryStart + override.index * 128;
    if (override.type !== undefined) {
      view.setUint8(offset + 66, override.type);
      if (override.type !== 0) writeName(view, offset, `Entry${override.index}`);
    }
    if (override.left !== undefined) view.setUint32(offset + 68, override.left, true);
    if (override.right !== undefined) view.setUint32(offset + 72, override.right, true);
    if (override.child !== undefined) view.setUint32(offset + 76, override.child, true);
  }
  for (const [index, nameLength] of options.badNameLengths ?? []) view.setUint16(directoryStart + index * 128 + 64, nameLength, true);
  if (needsMiniFat) {
    const miniFatStart = sectorSize * 4;
    for (let index = 0; index < sectorSize / 4; index += 1) view.setUint32(miniFatStart + index * 4, FREE, true);
    for (const [index, next] of (options.miniFatValues ?? [EOC, EOC]).entries()) view.setUint32(miniFatStart + index * 4, next, true);
  }
  return bytes.buffer;
}

describe('XLS compound-file preflight', () => {
  it('accepts and imports a valid SheetJS legacy XLS workbook', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['id', 'name'], ['001', 'Pump']]), 'Assets');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
    preflightXlsCfb(buffer);
    expect(parseWorkbook(buffer, 'Assets').records[0].values).toMatchObject({ id: '001', name: 'Pump' });
  });

  it('rejects malformed headers and truncated sectors', () => {
    const badHeader = new Uint8Array(makeCfb());
    new DataView(badHeader.buffer).setUint16(28, 0, true);
    expect(() => preflightXlsCfb(badHeader.buffer as ArrayBuffer)).toThrow(/little-endian/);
    const truncated = new Uint8Array(makeCfb()).slice(0, 700);
    expect(() => preflightXlsCfb(truncated.buffer as ArrayBuffer)).toThrow(/truncated or has a partial sector/);
  });

  it('rejects out-of-range and duplicate DIFAT FAT sector identifiers', () => {
    const outOfRange = new Uint8Array(makeCfb());
    new DataView(outOfRange.buffer).setUint32(76, 3, true);
    expect(() => preflightXlsCfb(outOfRange.buffer as ArrayBuffer)).toThrow(/out-of-range FAT sector id/);
    const duplicate = new Uint8Array(makeCfb({ fatCount: 2 }));
    new DataView(duplicate.buffer).setUint32(80, 0, true);
    expect(() => preflightXlsCfb(duplicate.buffer as ArrayBuffer)).toThrow(/duplicate or overlapping/);
    expect(() => preflightXlsCfb(makeCfb({ difatCount: 1 }))).toThrow(/not the minimum required/);
  });

  it('rejects oversized FAT counts and stream declarations before following chains', () => {
    expect(() => preflightXlsCfb(makeCfb({ fatCount: 4 }))).toThrow(/FAT or DIFAT sector counts/);
    expect(() => preflightXlsCfb(makeCfb({ rootSize: 16 * 1024 * 1024 + 1 }))).toThrow(/a stream exceeds/);
    const streams = Array.from({ length: 5 }, () => ({ start: EOC, size: 13 * 1024 * 1024 }));
    expect(() => preflightXlsCfb(makeCfb({ streams }))).toThrow(/64 MiB total/);
  });

  it('detects a FAT cycle in later unreferenced sectors', () => {
    const fatOverrides = new Map([[2, 3], [3, 2]]);
    expect(() => preflightXlsCfb(makeCfb({ sectorCount: 4, fatOverrides }))).toThrow(/FAT contains a cycle/);
  });

  it('bounds regular stream chains and rejects invalid FAT links', () => {
    expect(() => preflightXlsCfb(makeCfb({ streams: [{ start: 9, size: 5_000 }] }))).toThrow(/starts at an invalid sector/);
    expect(() => preflightXlsCfb(makeCfb({ fatOverrides: new Map([[2, 99]]) }))).toThrow(/out-of-range link/);
  });

  it('checks MiniFAT chains and catches mini-sector cycles', () => {
    const valid = makeCfb({ rootSize: 128, miniStream: { start: 0, size: 70 }, miniFatValues: [1, EOC] });
    expect(() => preflightXlsCfb(valid)).not.toThrow();
    const cycle = makeCfb({ rootSize: 128, miniStream: { start: 0, size: 70 }, miniFatValues: [1, 0] });
    expect(() => preflightXlsCfb(cycle)).toThrow(/MiniFAT contains a cycle/);
  });

  it('rejects cyclic directory child pointers before SheetJS traverses paths', () => {
    const buffer = makeCfb({ treeOverrides: [
      { index: 0, child: 1 },
      { index: 1, type: 1, child: 2 },
      { index: 2, type: 1, child: 1 },
    ] });
    expect(() => preflightXlsCfb(buffer)).toThrow(/directory entry is referenced by multiple tree pointers|directory tree contains a pointer cycle/);
  });

  it('rejects pointers stored in empty directory entries', () => {
    const buffer = makeCfb({ treeOverrides: [{ index: 1, child: 2 }] });
    expect(() => preflightXlsCfb(buffer)).toThrow(/empty directory entry contains a live tree pointer/);
  });

  it('bounds active directory names before SheetJS decodes them', () => {
    expect(() => preflightXlsCfb(makeCfb({ treeOverrides: [{ index: 1, type: 1 }], badNameLengths: new Map([[1, 65]]) }))).toThrow(/name length must be even and between 2 and 64/);
    expect(() => preflightXlsCfb(makeCfb({ treeOverrides: [{ index: 1, type: 1 }], badNameLengths: new Map([[1, 65_535]]) }))).toThrow(/name length must be even and between 2 and 64/);
    expect(() => preflightXlsCfb(makeCfb({ badNameLengths: new Map([[1, 4]]) }))).toThrow(/empty directory entry has an invalid name length/);
  });
});
