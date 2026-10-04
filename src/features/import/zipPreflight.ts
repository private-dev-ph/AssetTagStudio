import { ImportError } from './errors';
import { MAX_FILE_BYTES } from './limits';

const MAX_ZIP_ENTRIES = 2_048;
const MAX_MEMBER_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_EXPANSION_RATIO = 1_000;
const EOCD_MIN_BYTES = 22;
const EOCD_MAX_COMMENT = 0xffff;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_ID = 0x0001;

function invalid(detail: string): never {
  throw new ImportError(`Unsafe or unsupported XLSX ZIP archive: ${detail}`);
}

function u16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) invalid('truncated archive structure.');
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) invalid('truncated archive structure.');
  return view.getUint32(offset, true);
}

function checkExtraFields(view: DataView, start: number, length: number): void {
  const end = start + length;
  if (start < 0 || end > view.byteLength) invalid('extra field extends beyond the archive.');
  let cursor = start;
  while (cursor < end) {
    if (cursor + 4 > end) invalid('malformed extra field.');
    const id = u16(view, cursor);
    const size = u16(view, cursor + 2);
    cursor += 4;
    if (cursor + size > end) invalid('malformed extra field.');
    if (id === ZIP64_EXTRA_ID) invalid('ZIP64 extra fields are not supported. Resave the workbook as a standard XLSX file.');
    cursor += size;
  }
}

function findEocd(view: DataView): number {
  const earliest = Math.max(0, view.byteLength - EOCD_MIN_BYTES - EOCD_MAX_COMMENT);
  for (let offset = view.byteLength - EOCD_MIN_BYTES; offset >= earliest; offset -= 1) {
    if (u32(view, offset) !== EOCD_SIGNATURE) continue;
    const commentLength = u16(view, offset + 20);
    if (offset + EOCD_MIN_BYTES + commentLength === view.byteLength) return offset;
  }
  return invalid('end-of-central-directory record is missing, truncated, or followed by trailing data.');
}

function checkRatio(uncompressed: number, compressed: number): void {
  if (uncompressed > 0 && compressed === 0) invalid('a member has an impossible zero compressed size.');
  if (uncompressed > compressed * MAX_EXPANSION_RATIO) invalid(`a member exceeds the ${MAX_EXPANSION_RATIO}:1 expansion ratio limit.`);
}

export function preflightXlsxZip(buffer: ArrayBuffer): void {
  if (!(buffer instanceof ArrayBuffer)) invalid('input is not an ArrayBuffer.');
  if (buffer.byteLength > MAX_FILE_BYTES) throw new ImportError('The file exceeds the 10 MiB import limit.');
  if (buffer.byteLength < EOCD_MIN_BYTES) invalid('archive is truncated.');

  const view = new DataView(buffer);
  const eocd = findEocd(view);
  const diskNumber = u16(view, eocd + 4);
  const centralDisk = u16(view, eocd + 6);
  const diskEntryCount = u16(view, eocd + 8);
  const entryCount = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);

  if (diskNumber !== 0 || centralDisk !== 0 || diskEntryCount !== entryCount) invalid('multi-disk ZIP archives are not supported.');
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) invalid('ZIP64 archives are not supported.');
  if (u16(view, eocd + 20) !== 0) invalid('ZIP archive comments are not supported. Resave the workbook as a standard XLSX file.');
  if (entryCount > MAX_ZIP_ENTRIES) invalid(`archive contains more than ${MAX_ZIP_ENTRIES} entries.`);
  if (centralOffset + centralSize !== eocd) invalid('central directory range is invalid or includes unsupported archive records.');
  if (centralOffset > view.byteLength || centralSize > view.byteLength - centralOffset) invalid('central directory extends beyond the archive.');

  const localRanges: { start: number; end: number }[] = [];
  let centralCursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (centralCursor + 46 > eocd || u32(view, centralCursor) !== CENTRAL_SIGNATURE) invalid('central directory entry is missing or truncated.');
    const flags = u16(view, centralCursor + 8);
    const method = u16(view, centralCursor + 10);
    const crc = u32(view, centralCursor + 16);
    const compressedSize = u32(view, centralCursor + 20);
    const uncompressedSize = u32(view, centralCursor + 24);
    const nameLength = u16(view, centralCursor + 28);
    const extraLength = u16(view, centralCursor + 30);
    const commentLength = u16(view, centralCursor + 32);
    const startDisk = u16(view, centralCursor + 34);
    const localOffset = u32(view, centralCursor + 42);
    const recordEnd = centralCursor + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > eocd) invalid('central directory entry extends beyond its declared range.');
    if (startDisk !== 0) invalid('multi-disk ZIP entries are not supported.');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) invalid('ZIP64 member sizes or offsets are not supported.');
    if (flags & (0x0001 | 0x0040 | 0x2000)) invalid('encrypted ZIP members are not supported.');
    if (flags & 0x0008) invalid('streamed ZIP members using data descriptors are not supported. Resave the workbook as a standard XLSX file.');
    if (method !== 0 && method !== 8) invalid(`compression method ${method} is not supported.`);
    if (uncompressedSize > MAX_MEMBER_BYTES) invalid(`a member exceeds the ${MAX_MEMBER_BYTES / (1024 * 1024)} MiB uncompressed limit.`);
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) invalid(`archive exceeds the ${MAX_TOTAL_UNCOMPRESSED_BYTES / (1024 * 1024)} MiB total uncompressed limit.`);
    checkRatio(uncompressedSize, compressedSize);
    if (method === 0 && compressedSize !== uncompressedSize) invalid('a stored member has mismatched compressed and uncompressed sizes.');
    if (method === 8 && compressedSize > 0 && uncompressedSize === 0) invalid('deflated members with unknown or zero local uncompressed size are not supported.');
    checkExtraFields(view, centralCursor + 46 + nameLength, extraLength);

    if (localOffset >= centralOffset || localOffset + 30 > centralOffset || u32(view, localOffset) !== LOCAL_SIGNATURE) invalid('local member header is missing or out of range.');
    const localFlags = u16(view, localOffset + 6);
    const localMethod = u16(view, localOffset + 8);
    const localCrc = u32(view, localOffset + 14);
    const localCompressedSize = u32(view, localOffset + 18);
    const localUncompressedSize = u32(view, localOffset + 22);
    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const localNameStart = localOffset + 30;
    const localExtraStart = localNameStart + localNameLength;
    const dataStart = localExtraStart + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataStart > centralOffset || dataEnd > centralOffset || dataEnd > view.byteLength) invalid('compressed member data extends beyond the local area.');
    if (localFlags !== flags || localMethod !== method) invalid('local and central flags or compression methods differ.');
    if (localCrc !== crc || localCompressedSize !== compressedSize || localUncompressedSize !== uncompressedSize) invalid('local and central CRC or size fields differ.');
    if (localNameLength !== nameLength) invalid('local and central member names differ.');
    for (let nameIndex = 0; nameIndex < nameLength; nameIndex += 1) {
      if (view.getUint8(localNameStart + nameIndex) !== view.getUint8(centralCursor + 46 + nameIndex)) invalid('local and central member names differ.');
    }
    checkExtraFields(view, localExtraStart, localExtraLength);
    localRanges.push({ start: localOffset, end: dataEnd });
    centralCursor = recordEnd;
  }
  if (centralCursor !== eocd) invalid('central directory entry count or size does not match its contents.');

  localRanges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < localRanges.length; index += 1) {
    if (localRanges[index].start < localRanges[index - 1].end) invalid('local ZIP members overlap.');
  }
}
