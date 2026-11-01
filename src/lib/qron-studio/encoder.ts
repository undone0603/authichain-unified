/**
 * Deterministic QR Model 2 encoder (ISO/IEC 18004) that keeps its internals
 * visible: which modules are protected function patterns, which codeword
 * bit lands on which module, and how codewords split into Reed–Solomon
 * blocks. A conventional encoder hides all of this. QRON Studio needs it to
 * know which modules it may influence and how much error budget a change
 * spends.
 *
 * Coordinates: x is the column, y is the row, module index = y * size + x.
 * Module value 1 = dark.
 */

import { rsDivisor, rsRemainder } from "./gf256";

export type Ecl = "L" | "M" | "Q" | "H";
export type Mode = "numeric" | "alphanumeric" | "byte";

export const ECLS: readonly Ecl[] = ["L", "M", "Q", "H"];
export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

const ECL_ORDINAL: Record<Ecl, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECL_FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };

// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

// prettier-ignore
const NUM_ECC_BLOCKS: readonly (readonly number[])[] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/**
 * Misdecode-protection codewords (ISO/IEC 18004 Table 9, "p"). These ECC
 * codewords detect but do not correct, so they come off the correction
 * budget for the smallest symbols.
 */
const MISDECODE_PROTECTION: Record<string, number> = {
  "1L": 3,
  "1M": 2,
  "1Q": 1,
  "1H": 1,
  "2L": 2,
  "3L": 1,
};

export const ALPHANUMERIC_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

export const Role = {
  Data: 0,
  Finder: 1,
  Separator: 2,
  Timing: 3,
  Alignment: 4,
  Format: 5,
  Version: 6,
  DarkModule: 7,
} as const;
export type Role = (typeof Role)[keyof typeof Role];

function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
    throw new RangeError(`qr_version_out_of_range:${version}`);
  }
}

export function symbolSize(version: number): number {
  assertVersion(version);
  return version * 4 + 17;
}

/** Modules available for codewords and remainder bits, after function patterns. */
export function numRawDataModules(version: number): number {
  assertVersion(version);
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

export function eccCodewordsPerBlock(version: number, ecl: Ecl): number {
  assertVersion(version);
  return ECC_CODEWORDS_PER_BLOCK[ECL_ORDINAL[ecl]][version];
}

export function numEccBlocks(version: number, ecl: Ecl): number {
  assertVersion(version);
  return NUM_ECC_BLOCKS[ECL_ORDINAL[ecl]][version];
}

export function numDataCodewords(version: number, ecl: Ecl): number {
  return (
    Math.floor(numRawDataModules(version) / 8) -
    eccCodewordsPerBlock(version, ecl) * numEccBlocks(version, ecl)
  );
}

/** Codeword errors each block can correct, net of misdecode protection. */
export function correctableCodewordsPerBlock(version: number, ecl: Ecl): number {
  const p = MISDECODE_PROTECTION[`${version}${ecl}`] ?? 0;
  return Math.floor((eccCodewordsPerBlock(version, ecl) - p) / 2);
}

export function chooseMode(text: string): Mode {
  if (/^[0-9]*$/.test(text)) return "numeric";
  if ([...text].every((c) => ALPHANUMERIC_CHARSET.includes(c))) {
    return "alphanumeric";
  }
  return "byte";
}

function charCountBits(mode: Mode, version: number): number {
  const tier = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  if (mode === "numeric") return [10, 12, 14][tier];
  if (mode === "alphanumeric") return [9, 11, 13][tier];
  return [8, 16, 16][tier];
}

function pushBits(out: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) out.push((value >>> i) & 1);
}

/**
 * Header + payload bits for a single-segment symbol (no terminator, no
 * padding). Returns null when the character count does not fit the field.
 */
export function payloadBits(text: string, mode: Mode, version: number): number[] | null {
  const out: number[] = [];
  if (mode === "numeric") {
    if (!/^[0-9]*$/.test(text)) throw new Error("payload_not_numeric");
    pushBits(out, 0x1, 4);
    if (text.length >= 1 << charCountBits(mode, version)) return null;
    pushBits(out, text.length, charCountBits(mode, version));
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      pushBits(out, parseInt(chunk, 10), chunk.length * 3 + 1);
    }
    return out;
  }
  if (mode === "alphanumeric") {
    pushBits(out, 0x2, 4);
    if (text.length >= 1 << charCountBits(mode, version)) return null;
    pushBits(out, text.length, charCountBits(mode, version));
    for (let i = 0; i < text.length; i += 2) {
      const a = ALPHANUMERIC_CHARSET.indexOf(text[i]);
      if (a < 0) throw new Error("payload_not_alphanumeric");
      if (i + 1 < text.length) {
        const b = ALPHANUMERIC_CHARSET.indexOf(text[i + 1]);
        if (b < 0) throw new Error("payload_not_alphanumeric");
        pushBits(out, a * 45 + b, 11);
      } else {
        pushBits(out, a, 6);
      }
    }
    return out;
  }
  const bytes = new TextEncoder().encode(text);
  pushBits(out, 0x4, 4);
  if (bytes.length >= 1 << charCountBits(mode, version)) return null;
  pushBits(out, bytes.length, charCountBits(mode, version));
  for (const b of bytes) pushBits(out, b, 8);
  return out;
}

/** Smallest version in [minVersion, 40] whose data capacity fits the payload. */
export function minimumVersion(
  text: string,
  ecl: Ecl,
  mode: Mode = chooseMode(text),
  minVersion = MIN_VERSION
): number {
  for (let v = minVersion; v <= MAX_VERSION; v++) {
    const bits = payloadBits(text, mode, v);
    if (bits && bits.length <= numDataCodewords(v, ecl) * 8) return v;
  }
  throw new RangeError("payload_too_long");
}

/**
 * Spec-conformant data codewords: header, payload, terminator, zero bits
 * to the byte boundary, then alternating 0xEC / 0x11 pad codewords.
 */
export function standardDataCodewords(
  text: string,
  mode: Mode,
  version: number,
  ecl: Ecl
): Uint8Array {
  const bits = payloadBits(text, mode, version);
  const capacity = numDataCodewords(version, ecl) * 8;
  if (!bits || bits.length > capacity) throw new RangeError("payload_exceeds_capacity");
  pushBits(bits, 0, Math.min(4, capacity - bits.length));
  pushBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) pushBits(bits, pad, 8);
  return bitsToBytes(bits);
}

export function bitsToBytes(bits: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) out[i >>> 3] |= 0x80 >>> (i & 7);
  }
  return out;
}

export type BlockStructure = {
  numBlocks: number;
  eccLen: number;
  /** data codewords per block */
  dataLen: number[];
  /** offset of each block's first data codeword in the data codeword array */
  dataStart: number[];
  /** for each interleaved codeword: its block */
  cwBlock: Int16Array;
  /** for each interleaved codeword: index within [block data..., block ecc...] */
  cwIndex: Int16Array;
};

const blockCache = new Map<string, BlockStructure>();

/** How the interleaved codeword sequence maps back onto Reed–Solomon blocks. */
export function blockStructure(version: number, ecl: Ecl): BlockStructure {
  const key = `${version}${ecl}`;
  const cached = blockCache.get(key);
  if (cached) return cached;
  const numBlocks = numEccBlocks(version, ecl);
  const eccLen = eccCodewordsPerBlock(version, ecl);
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const shortDataLen = shortBlockLen - eccLen;
  const dataLen: number[] = [];
  const dataStart: number[] = [];
  let k = 0;
  for (let j = 0; j < numBlocks; j++) {
    dataStart.push(k);
    dataLen.push(shortDataLen + (j < numShortBlocks ? 0 : 1));
    k += dataLen[j];
  }
  const cwBlock = new Int16Array(rawCodewords);
  const cwIndex = new Int16Array(rawCodewords);
  let n = 0;
  // Every block is padded to shortBlockLen + 1; short blocks carry a
  // placeholder at index shortDataLen, which interleaving skips.
  for (let i = 0; i <= shortBlockLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      const isShort = j < numShortBlocks;
      if (isShort && i === shortDataLen) continue;
      cwBlock[n] = j;
      cwIndex[n] = isShort && i > shortDataLen ? i - 1 : i;
      n++;
    }
  }
  if (n !== rawCodewords) throw new Error(`block_map_mismatch:${n}/${rawCodewords}`);
  const result = { numBlocks, eccLen, dataLen, dataStart, cwBlock, cwIndex };
  blockCache.set(key, result);
  return result;
}

/** Splits data into blocks, appends ECC, interleaves. */
export function addEccAndInterleave(
  data: Uint8Array,
  version: number,
  ecl: Ecl
): Uint8Array {
  const bs = blockStructure(version, ecl);
  if (data.length !== numDataCodewords(version, ecl)) {
    throw new RangeError("data_codeword_count_mismatch");
  }
  const divisor = rsDivisor(bs.eccLen);
  const blocks: Uint8Array[] = [];
  for (let j = 0; j < bs.numBlocks; j++) {
    const dat = data.subarray(bs.dataStart[j], bs.dataStart[j] + bs.dataLen[j]);
    const block = new Uint8Array(bs.dataLen[j] + bs.eccLen);
    block.set(dat);
    block.set(rsRemainder(dat, divisor), bs.dataLen[j]);
    blocks.push(block);
  }
  const out = new Uint8Array(bs.cwBlock.length);
  for (let n = 0; n < out.length; n++) out[n] = blocks[bs.cwBlock[n]][bs.cwIndex[n]];
  return out;
}

export type QrLayout = {
  version: number;
  size: number;
  isFunction: Uint8Array;
  /** Function-module values with format bits left light (drawn per ECL/mask). */
  functionValue: Uint8Array;
  role: Uint8Array;
  /** module index for each bit of the raw codeword stream, in placement order */
  bitOrder: Int32Array;
  /** inverse of bitOrder; -1 for function modules */
  streamBit: Int32Array;
  alignmentCenters: number[];
};

const layoutCache = new Map<number, QrLayout>();

export function alignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 17 - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

export function layout(version: number): QrLayout {
  const cached = layoutCache.get(version);
  if (cached) return cached;
  const size = symbolSize(version);
  const isFunction = new Uint8Array(size * size);
  const functionValue = new Uint8Array(size * size);
  const role = new Uint8Array(size * size);
  const set = (x: number, y: number, dark: boolean, r: Role) => {
    const i = y * size + x;
    functionValue[i] = dark ? 1 : 0;
    isFunction[i] = 1;
    role[i] = r;
  };

  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0, Role.Timing);
    set(i, 6, i % 2 === 0, Role.Timing);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4, dist === 4 ? Role.Separator : Role.Finder);
      }
    }
  }
  const align = alignmentPatternPositions(version);
  const last = align.length - 1;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(
            align[i] + dx,
            align[j] + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
            Role.Alignment
          );
        }
      }
    }
  }
  // Reserve the format areas; the real bits depend on ECL and mask.
  for (let i = 0; i <= 5; i++) set(8, i, false, Role.Format);
  set(8, 7, false, Role.Format);
  set(8, 8, false, Role.Format);
  set(7, 8, false, Role.Format);
  for (let i = 9; i < 15; i++) set(14 - i, 8, false, Role.Format);
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, false, Role.Format);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, false, Role.Format);
  set(8, size - 8, true, Role.DarkModule);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit, Role.Version);
      set(b, a, bit, Role.Version);
    }
  }

  const bitOrder = new Int32Array(numRawDataModules(version));
  const streamBit = new Int32Array(size * size).fill(-1);
  let n = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        const idx = y * size + x;
        if (isFunction[idx]) continue;
        bitOrder[n] = idx;
        streamBit[idx] = n;
        n++;
      }
    }
  }
  if (n !== bitOrder.length) throw new Error(`placement_mismatch:${n}/${bitOrder.length}`);

  const result: QrLayout = {
    version,
    size,
    isFunction,
    functionValue,
    role,
    bitOrder,
    streamBit,
    alignmentCenters: align,
  };
  layoutCache.set(version, result);
  return result;
}

/** True where mask pattern `mask` inverts the module at (x, y). */
export function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new RangeError(`mask_out_of_range:${mask}`);
  }
}

/** The 15 format bits (BCH(15,5), XOR 0x5412), LSB = bit 0. */
export function formatBits(ecl: Ecl, mask: number): number {
  const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormatBits(modules: Uint8Array, size: number, ecl: Ecl, mask: number): void {
  const bits = formatBits(ecl, mask);
  const bit = (i: number) => (bits >>> i) & 1;
  const put = (x: number, y: number, v: number) => {
    modules[y * size + x] = v;
  };
  for (let i = 0; i <= 5; i++) put(8, i, bit(i));
  put(8, 7, bit(6));
  put(8, 8, bit(7));
  put(7, 8, bit(8));
  for (let i = 9; i < 15; i++) put(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) put(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) put(8, size - 15 + i, bit(i));
  put(8, size - 8, 1);
}

export type QrSymbol = {
  payload: string;
  mode: Mode;
  version: number;
  ecl: Ecl;
  mask: number;
  size: number;
  modules: Uint8Array;
  dataCodewords: Uint8Array;
  codewords: Uint8Array;
};

export type EncodeOptions = {
  payload: string;
  ecl: Ecl;
  mask: number;
  version?: number;
  mode?: Mode;
  /** Pre-built data codewords (e.g. from inverse synthesis). */
  dataCodewords?: Uint8Array;
};

export function encodeSymbol(opts: EncodeOptions): QrSymbol {
  const mode = opts.mode ?? chooseMode(opts.payload);
  const version = opts.version ?? minimumVersion(opts.payload, opts.ecl, mode);
  if (!Number.isInteger(opts.mask) || opts.mask < 0 || opts.mask > 7) {
    throw new RangeError(`mask_out_of_range:${opts.mask}`);
  }
  const lay = layout(version);
  const data =
    opts.dataCodewords ?? standardDataCodewords(opts.payload, mode, version, opts.ecl);
  const codewords = addEccAndInterleave(data, version, opts.ecl);
  const { size } = lay;
  const modules = lay.functionValue.slice();
  const totalBits = codewords.length * 8;
  for (let i = 0; i < lay.bitOrder.length; i++) {
    const idx = lay.bitOrder[i];
    let v = i < totalBits ? (codewords[i >>> 3] >>> (7 - (i & 7))) & 1 : 0;
    if (maskBit(opts.mask, idx % size, Math.floor(idx / size))) v ^= 1;
    modules[idx] = v;
  }
  drawFormatBits(modules, size, opts.ecl, opts.mask);
  return {
    payload: opts.payload,
    mode,
    version,
    ecl: opts.ecl,
    mask: opts.mask,
    size,
    modules,
    dataCodewords: data,
    codewords,
  };
}

/** ISO/IEC 18004 mask penalty (N1..N4). Lower reads as a "calmer" pattern. */
export function penaltyScore(modules: Uint8Array, size: number): number {
  const N1 = 3;
  const N2 = 3;
  const N3 = 40;
  const N4 = 10;
  let result = 0;
  const at = (x: number, y: number) => modules[y * size + x];

  const countPatterns = (h: number[]) => {
    const n = h[1];
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (
      (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) +
      (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0)
    );
  };
  const addHistory = (run: number, h: number[]) => {
    if (h[0] === 0) run += size;
    h.pop();
    h.unshift(run);
  };
  const scanLine = (get: (i: number) => number) => {
    let runColor = 0;
    let run = 0;
    const h = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < size; i++) {
      const c = get(i);
      if (c === runColor) {
        run++;
        if (run === 5) result += N1;
        else if (run > 5) result++;
      } else {
        addHistory(run, h);
        if (!runColor) result += countPatterns(h) * N3;
        runColor = c;
        run = 1;
      }
    }
    if (runColor) {
      addHistory(run, h);
      run = 0;
    }
    run += size;
    addHistory(run, h);
    result += countPatterns(h) * N3;
  };
  for (let y = 0; y < size; y++) scanLine((x) => at(x, y));
  for (let x = 0; x < size; x++) scanLine((y) => at(x, y));

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) result += N2;
    }
  }
  let dark = 0;
  for (const m of modules) dark += m;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += Math.max(0, k) * N4;
  return result;
}
