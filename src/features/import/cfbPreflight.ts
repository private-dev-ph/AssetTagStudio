import { ImportError } from './errors';
import { MAX_FILE_BYTES } from './limits';

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const FREE_SECTOR = 0xffffffff;
const END_OF_CHAIN = 0xfffffffe;
const FAT_SECTOR = 0xfffffffd;
const DIFAT_SECTOR = 0xfffffffc;
const NO_STREAM = 0xffffffff;
const MAX_DIRECTORY_ENTRIES = 2_048;
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_STREAM_BYTES = 64 * 1024 * 1024;
const MINI_STREAM_CUTOFF = 4_096;
const MINI_SECTOR_SIZE = 64;

function invalid(detail: string): never {
  throw new ImportError(`Unsafe or unsupported XLS compound file: ${detail}`);
}

function read16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) invalid('truncated header or sector.');
  return view.getUint16(offset, true);
}

function read32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) invalid('truncated header or sector.');
  return view.getUint32(offset, true);
}

function isRegularSector(value: number, sectorCount: number): boolean {
  return value < sectorCount;
}

function validateLinks(table: Uint32Array, count: number, reserved: Set<number>, label: string): void {
  const state = new Uint8Array(count);
  for (let sector = 0; sector < count; sector += 1) {
    const next = table[sector];
    if (next === FREE_SECTOR || next === END_OF_CHAIN) continue;
    if (next === FAT_SECTOR || next === DIFAT_SECTOR) invalid(`${label} contains an unexpected reserved-sector marker.`);
    if (!isRegularSector(next, count)) invalid(`${label} contains an out-of-range link.`);
    if (reserved.has(next)) invalid(`${label} links into a FAT or DIFAT sector.`);
  }

  for (let start = 0; start < count; start += 1) {
    if (state[start] !== 0) continue;
    let current = start;
    const path: number[] = [];
    while (current < count && state[current] === 0) {
      state[current] = 1;
      path.push(current);
      const next = table[current];
      if (!isRegularSector(next, count)) {
        current = next;
        break;
      }
      current = next;
    }
    if (current < count && state[current] === 1) invalid(`${label} contains a cycle.`);
    for (const sector of path) state[sector] = 2;
  }
}

function walkChain(table: Uint32Array, start: number, sectorCount: number, label: string, expectedLength?: number, reserved?: Set<number>): number[] {
  if (start === END_OF_CHAIN || start === FREE_SECTOR) {
    if (expectedLength === undefined || expectedLength === 0) return [];
    invalid(`${label} chain is shorter than its declared size.`);
  }
  if (!isRegularSector(start, sectorCount) || reserved?.has(start)) invalid(`${label} starts at an invalid sector.`);
  const seen = new Set<number>();
  const sectors: number[] = [];
  let current = start;
  while (isRegularSector(current, sectorCount)) {
    if (reserved?.has(current)) invalid(`${label} enters a FAT or DIFAT sector.`);
    if (seen.has(current)) invalid(`${label} chain contains a cycle.`);
    seen.add(current);
    sectors.push(current);
    if (sectors.length > sectorCount) invalid(`${label} chain exceeds the physical sector count.`);
    const next = table[current];
    if (next === END_OF_CHAIN) break;
    if (next === FREE_SECTOR || next === FAT_SECTOR || next === DIFAT_SECTOR) invalid(`${label} chain ends with an invalid marker.`);
    if (!isRegularSector(next, sectorCount)) invalid(`${label} chain has an out-of-range link.`);
    current = next;
  }
  if (expectedLength !== undefined && sectors.length !== expectedLength) invalid(`${label} chain length does not match its declared size.`);
  return sectors;
}

export function preflightXlsCfb(buffer: ArrayBuffer): void {
  if (!(buffer instanceof ArrayBuffer)) invalid('input is not an ArrayBuffer.');
  if (buffer.byteLength > MAX_FILE_BYTES) throw new ImportError('The file exceeds the 10 MiB import limit.');
  if (buffer.byteLength < 512) invalid('compound file header is truncated.');
  const view = new DataView(buffer);
  for (let index = 0; index < SIGNATURE.length; index += 1) {
    if (view.getUint8(index) !== SIGNATURE[index]) invalid('compound file signature is invalid.');
  }

  const majorVersion = read16(view, 26);
  const byteOrder = read16(view, 28);
  const sectorShift = read16(view, 30);
  const miniSectorShift = read16(view, 32);
  if ((majorVersion !== 3 && majorVersion !== 4) || byteOrder !== 0xfffe) invalid('only little-endian CFB version 3 or 4 is supported.');
  const sectorSize = 2 ** sectorShift;
  if ((majorVersion === 3 && sectorShift !== 9) || (majorVersion === 4 && sectorShift !== 12) || miniSectorShift !== 6) invalid('sector size shifts are invalid.');
  if (buffer.byteLength < sectorSize || buffer.byteLength % sectorSize !== 0) invalid('compound file is truncated or has a partial sector.');
  const sectorCount = buffer.byteLength / sectorSize - 1;
  if (sectorCount < 1) invalid('compound file contains no sectors.');

  const directorySectorCount = read32(view, 40);
  const fatSectorCount = read32(view, 44);
  const firstDirectorySector = read32(view, 48);
  const miniStreamCutoff = read32(view, 56);
  const firstMiniFatSector = read32(view, 60);
  const miniFatSectorCount = read32(view, 64);
  const firstDifatSector = read32(view, 68);
  const difatSectorCount = read32(view, 72);
  if (majorVersion === 3 && directorySectorCount !== 0) invalid('version 3 directory-sector count must be zero.');
  if (miniStreamCutoff !== MINI_STREAM_CUTOFF) invalid('mini stream cutoff is unsupported.');
  if (fatSectorCount === 0 || fatSectorCount > sectorCount || difatSectorCount > sectorCount || miniFatSectorCount > sectorCount) invalid('FAT or DIFAT sector counts exceed the file bounds.');
  const difatEntriesPerSector = sectorSize / 4 - 1;
  const expectedDifatSectorCount = Math.ceil(Math.max(0, fatSectorCount - 109) / difatEntriesPerSector);
  if (difatSectorCount !== expectedDifatSectorCount) invalid('DIFAT sector count is not the minimum required by the FAT count.');

  const fatSectorIds: number[] = [];
  const fatIdSet = new Set<number>();
  const difatIds = new Set<number>();
  const addFatSector = (id: number) => {
    if (!isRegularSector(id, sectorCount)) invalid('DIFAT contains an out-of-range FAT sector id.');
    if (fatIdSet.has(id) || difatIds.has(id)) invalid('DIFAT contains a duplicate or overlapping sector id.');
    fatIdSet.add(id);
    fatSectorIds.push(id);
    if (fatSectorIds.length > fatSectorCount) invalid('DIFAT contains more FAT sectors than declared.');
  };
  const expectedHeaderFatCount = Math.min(fatSectorCount, 109);
  for (let index = 0; index < 109; index += 1) {
    const id = read32(view, 76 + index * 4);
    if (index < expectedHeaderFatCount) {
      if (id === FREE_SECTOR) invalid('header DIFAT FAT-sector ids are not contiguous.');
      addFatSector(id);
    } else if (id !== FREE_SECTOR) invalid('header DIFAT contains unexpected extra FAT-sector ids.');
  }

  if (difatSectorCount === 0) {
    if (firstDifatSector !== END_OF_CHAIN && firstDifatSector !== FREE_SECTOR) invalid('DIFAT start disagrees with its zero sector count.');
  } else {
    let current = firstDifatSector;
    for (let chainIndex = 0; chainIndex < difatSectorCount; chainIndex += 1) {
      if (!isRegularSector(current, sectorCount) || fatIdSet.has(current) || difatIds.has(current)) invalid('DIFAT chain has an invalid or repeated sector id.');
      difatIds.add(current);
      const sectorStart = (current + 1) * sectorSize;
      for (let entry = 0; entry < difatEntriesPerSector; entry += 1) {
        const id = read32(view, sectorStart + entry * 4);
        if (id !== FREE_SECTOR) addFatSector(id);
      }
      const next = read32(view, sectorStart + difatEntriesPerSector * 4);
      if (chainIndex + 1 === difatSectorCount) {
        if (next !== END_OF_CHAIN) invalid('DIFAT chain is longer than its declared sector count.');
      } else {
        if (!isRegularSector(next, sectorCount)) invalid('DIFAT chain ends before its declared sector count.');
        current = next;
      }
    }
  }
  if (fatSectorIds.length !== fatSectorCount) invalid('DIFAT FAT-sector count does not match the header.');

  const reserved = new Set<number>([...fatIdSet, ...difatIds]);
  const fatTable = new Uint32Array(fatSectorCount * sectorSize / 4);
  let fatCursor = 0;
  for (const sectorId of fatSectorIds) {
    const sectorStart = (sectorId + 1) * sectorSize;
    for (let offset = 0; offset < sectorSize; offset += 4) fatTable[fatCursor++] = read32(view, sectorStart + offset);
  }
  if (fatTable.length < sectorCount) invalid('FAT table does not cover all physical sectors.');
  for (const sectorId of fatIdSet) if (fatTable[sectorId] !== FAT_SECTOR) invalid('FAT sector marker is invalid.');
  for (const sectorId of difatIds) if (fatTable[sectorId] !== DIFAT_SECTOR) invalid('DIFAT sector marker is invalid.');
  const actualFat = fatTable.slice(0, sectorCount);
  for (const sectorId of reserved) actualFat[sectorId] = FREE_SECTOR;
  validateLinks(actualFat, sectorCount, reserved, 'FAT');

  const directorySectors = walkChain(actualFat, firstDirectorySector, sectorCount, 'directory', undefined, reserved);
  if (directorySectors.length === 0) invalid('directory stream is empty.');
  if (majorVersion === 4 && directorySectorCount !== directorySectors.length) invalid('directory-sector count does not match its chain.');
  const directoryCapacity = directorySectors.length * sectorSize / 128;
  if (directoryCapacity > MAX_DIRECTORY_ENTRIES) invalid(`directory stream exceeds ${MAX_DIRECTORY_ENTRIES} entries.`);

  const directoryEntries: { type: number; start: number; size: number; left: number; right: number; child: number }[] = [];
  let rootCount = 0;
  let declaredTotal = 0;
  const smallStreams: { start: number; size: number }[] = [];
  const regularStreams: { start: number; size: number; label: string }[] = [];
  for (const sectorId of directorySectors) {
    const sectorStart = (sectorId + 1) * sectorSize;
    for (let offset = 0; offset < sectorSize; offset += 128) {
      const entryOffset = sectorStart + offset;
      const nameLength = read16(view, entryOffset + 64);
      const type = view.getUint8(entryOffset + 66);
      const left = read32(view, entryOffset + 68);
      const right = read32(view, entryOffset + 72);
      const child = read32(view, entryOffset + 76);
      if (type === 0) {
        if (nameLength !== 0 && nameLength !== 2) invalid('empty directory entry has an invalid name length.');
        if (nameLength === 2 && read16(view, entryOffset) !== 0) invalid('empty directory entry name is not terminated.');
        if (left !== NO_STREAM || right !== NO_STREAM || child !== NO_STREAM) invalid('empty directory entry contains a live tree pointer.');
        directoryEntries.push({ type, start: END_OF_CHAIN, size: 0, left, right, child });
        continue;
      }
      if (type !== 1 && type !== 2 && type !== 5) invalid('directory entry type is invalid.');
      if (nameLength < 2 || nameLength > 64 || nameLength % 2 !== 0) invalid('directory entry name length must be even and between 2 and 64 bytes.');
      if (read16(view, entryOffset + nameLength - 2) !== 0) invalid('directory entry name is not null-terminated.');
      if (type === 5) rootCount += 1;
      const start = read32(view, entryOffset + 116);
      const highSize = read32(view, entryOffset + 124);
      const lowSize = read32(view, entryOffset + 120);
      if (highSize !== 0) invalid('64-bit stream sizes are not supported.');
      const size = lowSize;
      directoryEntries.push({ type, start, size, left, right, child });
      if (type === 1 && size !== 0) invalid('storage directory entries cannot declare stream data.');
      if (type !== 2 && type !== 5) continue;
      if (size > MAX_STREAM_BYTES) invalid(`a stream exceeds ${MAX_STREAM_BYTES / (1024 * 1024)} MiB.`);
      declaredTotal += size;
      if (declaredTotal > MAX_TOTAL_STREAM_BYTES) invalid(`streams exceed ${MAX_TOTAL_STREAM_BYTES / (1024 * 1024)} MiB total.`);
      if (type === 5 || size >= MINI_STREAM_CUTOFF) regularStreams.push({ start, size, label: type === 5 ? 'root mini stream' : 'regular stream' });
      else if (size > 0) smallStreams.push({ start, size });
      else if (start !== END_OF_CHAIN && start !== FREE_SECTOR) invalid('empty stream has an invalid start sector.');
    }
  }
  if (rootCount !== 1 || directoryEntries[0]?.type !== 5) invalid('root directory entry is missing or misplaced.');
  validateDirectoryTree(directoryEntries);

  let rootMiniStreamSize = 0;
  for (const stream of regularStreams) {
    const expected = Math.ceil(stream.size / sectorSize);
    walkChain(actualFat, stream.start, sectorCount, stream.label, expected, reserved);
    if (stream.label === 'root mini stream') rootMiniStreamSize = stream.size;
  }

  const miniCount = Math.ceil(rootMiniStreamSize / MINI_SECTOR_SIZE);
  let miniFat = new Uint32Array();
  if (miniFatSectorCount > 0) {
    const miniFatSectors = walkChain(actualFat, firstMiniFatSector, sectorCount, 'MiniFAT', miniFatSectorCount, reserved);
    miniFat = new Uint32Array(miniFatSectorCount * sectorSize / 4);
    let cursor = 0;
    for (const sectorId of miniFatSectors) {
      const sectorStart = (sectorId + 1) * sectorSize;
      for (let offset = 0; offset < sectorSize; offset += 4) miniFat[cursor++] = read32(view, sectorStart + offset);
    }
  } else if (firstMiniFatSector !== END_OF_CHAIN && firstMiniFatSector !== FREE_SECTOR) invalid('MiniFAT start disagrees with its zero sector count.');
  if (miniCount > miniFat.length) invalid('MiniFAT does not cover the root mini stream.');
  if (miniCount) {
    const actualMiniFat = miniFat.slice(0, miniCount);
    validateLinks(actualMiniFat, miniCount, new Set(), 'MiniFAT');
  }
  for (const stream of smallStreams) {
    const expected = Math.ceil(stream.size / MINI_SECTOR_SIZE);
    walkChain(miniFat, stream.start, miniCount, 'mini stream', expected);
  }
}

function validateDirectoryTree(entries: { type: number; left: number; right: number; child: number }[]): void {
  const incoming = new Uint8Array(entries.length);
  const color = new Uint8Array(entries.length);
  const children = entries.map((entry) => [entry.left, entry.right, entry.child]);
  if (entries[0]?.type !== 5 || entries[0].left !== NO_STREAM || entries[0].right !== NO_STREAM) invalid('root directory entry has invalid sibling pointers.');
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    for (const pointer of children[index]) {
      if (pointer === NO_STREAM) continue;
      if (pointer >= entries.length) invalid('directory tree pointer is out of range.');
      if (entries[pointer].type === 0) invalid('directory tree pointer refers to an empty entry.');
      if (entry.type === 2 && pointer === entry.child) invalid('stream entries cannot contain child entries.');
      incoming[pointer] += 1;
      if (incoming[pointer] > 1) invalid('directory entry is referenced by multiple tree pointers.');
    }
  }
  if (incoming[0] !== 0) invalid('root directory entry is referenced by another tree node.');

  for (let start = 0; start < entries.length; start += 1) {
    if (entries[start].type === 0 || color[start] !== 0) continue;
    const stack: { index: number; nextChild: number }[] = [{ index: start, nextChild: 0 }];
    color[start] = 1;
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const pointer = children[frame.index][frame.nextChild];
      frame.nextChild += 1;
      if (frame.nextChild > 3) {
        color[frame.index] = 2;
        stack.pop();
        continue;
      }
      if (pointer === NO_STREAM) continue;
      if (color[pointer] === 1) invalid('directory tree contains a pointer cycle.');
      if (color[pointer] === 0) {
        color[pointer] = 1;
        stack.push({ index: pointer, nextChild: 0 });
      }
    }
  }
}
