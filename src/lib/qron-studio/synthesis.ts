/**
 * Inverse QR synthesis: given a payload and a target image, find the valid
 * QR symbol that most closely resembles the image.
 *
 * The data stream is header + payload + 4-bit terminator. Every bit after
 * the terminator is ignored by conforming decoders, so those bits are free.
 * Reed–Solomon is linear over GF(2), so each module in a block is an affine
 * function of that block's free bits. Incremental Gaussian elimination takes
 * the module constraints in priority order and keeps each one that is
 * independent of the constraints already taken. The free bits then solve
 * exactly, and the symbol stays a valid, fully error-corrected code that
 * decodes to the exact payload. No error-correction budget is spent.
 *
 * An optional error budget can then flip a bounded number of further
 * mismatched modules. These are counted per block against the block's
 * correction capacity and reported, never hidden.
 */

import {
  blockStructure,
  bitsToBytes,
  chooseMode,
  correctableCodewordsPerBlock,
  encodeSymbol,
  layout,
  maskBit,
  numDataCodewords,
  payloadBits,
  standardDataCodewords,
  type Ecl,
  type Mode,
  type QrSymbol,
} from "./encoder";
import { gfMul, rsDivisor, rsRemainder } from "./gf256";

export type ModuleTarget = {
  /** 1 where the artwork wants a dark module */
  want: Uint8Array;
  /** priority of honouring `want` at each module; >= 0 */
  weight: Float32Array;
};

export type SynthesisOptions = {
  payload: string;
  version: number;
  ecl: Ecl;
  mask: number;
  mode?: Mode;
  /**
   * Fraction (0..1) of each block's correctable codewords that may be
   * spent on further flips. 0 keeps the full error-correction margin.
   */
  errorBudget?: number;
  /**
   * Keep the spec's 0xEC/0x11 pad codewords instead of filling the region
   * after the terminator with art bits. No free bits remain; only the mask
   * choice and the error budget shape the artwork.
   */
  strictPadding?: boolean;
  /** value for free bits no constraint pins down */
  tieBreak?: (blockIndex: number, freeIndex: number) => 0 | 1;
};

export type SynthesisResult = {
  symbol: QrSymbol;
  freeBits: number;
  /** modules forced to match the target by construction */
  pinned: number;
  /** modules flipped from the error budget */
  flips: number;
  /** per block: codewords damaged by budgeted flips / correctable */
  damagedCodewords: number[];
  correctableCodewords: number[];
  /** weighted agreement with the target over non-function modules */
  agreement: number;
  /** unweighted agreement over every module in the symbol */
  coverage: number;
};

type Bitset = Uint32Array;

function popcount(v: number): number {
  v >>>= 0;
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

/** Row-reduced GF(2) basis keyed by each row's lowest set bit. */
class Gf2Basis {
  readonly rows: (Bitset | null)[];
  readonly rhs: Uint8Array;
  size = 0;

  constructor(
    readonly vars: number,
    readonly words: number
  ) {
    this.rows = new Array(vars).fill(null);
    this.rhs = new Uint8Array(vars);
  }

  /** Adds the constraint row·x = rhs if independent. Returns true when added. */
  add(row: Bitset, rhs: number): boolean {
    const r = row.slice();
    let w = 0;
    for (;;) {
      while (w < this.words && r[w] === 0) w++;
      if (w === this.words) return false;
      const low = r[w] & -r[w];
      const p = w * 32 + (31 - Math.clz32(low));
      const basis = this.rows[p];
      if (!basis) {
        this.rows[p] = r;
        this.rhs[p] = rhs;
        this.size++;
        return true;
      }
      for (let k = w; k < this.words; k++) r[k] ^= basis[k];
      rhs ^= this.rhs[p];
    }
  }

  solve(initial: (i: number) => 0 | 1): Bitset {
    const x = new Uint32Array(this.words);
    for (let i = 0; i < this.vars; i++) {
      if (!this.rows[i] && initial(i)) x[i >>> 5] |= 1 << (i & 31);
    }
    for (let p = this.vars - 1; p >= 0; p--) {
      const row = this.rows[p];
      if (!row) continue;
      let parity = this.rhs[p];
      for (let k = p >>> 5; k < this.words; k++) parity ^= popcount(row[k] & x[k]) & 1;
      if (parity) x[p >>> 5] |= 1 << (p & 31);
    }
    return x;
  }
}

/** Data bit index (MSB-first) where the free region begins. */
export function freeRegionStart(
  payload: string,
  mode: Mode,
  version: number,
  ecl: Ecl
): number {
  const bits = payloadBits(payload, mode, version);
  const capacity = numDataCodewords(version, ecl) * 8;
  if (!bits || bits.length > capacity) throw new RangeError("payload_exceeds_capacity");
  return bits.length + Math.min(4, capacity - bits.length);
}

export function synthesize(opts: SynthesisOptions, target: ModuleTarget): SynthesisResult {
  const { payload, version, ecl, mask } = opts;
  const mode = opts.mode ?? chooseMode(payload);
  const lay = layout(version);
  const { size } = lay;
  if (target.want.length !== size * size || target.weight.length !== size * size) {
    throw new RangeError("target_size_mismatch");
  }
  const bs = blockStructure(version, ecl);
  const numData = numDataCodewords(version, ecl);
  const freeStart = opts.strictPadding
    ? numData * 8
    : freeRegionStart(payload, mode, version, ecl);

  // Base data stream: payload, terminator, then zeros in the free region.
  const head = payloadBits(payload, mode, version)!;
  const baseBits = new Uint8Array(numData * 8);
  baseBits.set(head);
  const data = opts.strictPadding
    ? standardDataCodewords(payload, mode, version, ecl)
    : bitsToBytes(baseBits);

  const divisor = rsDivisor(bs.eccLen);
  const totalCodewordBits = bs.cwBlock.length * 8;

  // Group candidate modules by block, with their local bit position.
  type Candidate = { moduleIdx: number; local: number; weight: number };
  const perBlock: Candidate[][] = Array.from({ length: bs.numBlocks }, () => []);
  const remainderModules: number[] = [];
  for (let s = 0; s < lay.bitOrder.length; s++) {
    const moduleIdx = lay.bitOrder[s];
    if (s >= totalCodewordBits) {
      remainderModules.push(moduleIdx);
      continue;
    }
    const cw = s >>> 3;
    const j = bs.cwBlock[cw];
    perBlock[j].push({
      moduleIdx,
      local: bs.cwIndex[cw] * 8 + (s & 7),
      weight: target.weight[moduleIdx],
    });
  }

  let freeBitsTotal = 0;
  let pinned = 0;
  for (let j = 0; j < bs.numBlocks; j++) {
    const D = bs.dataLen[j];
    const start = bs.dataStart[j] * 8;
    const firstFree = Math.max(0, freeStart - start);
    const F = Math.max(0, D * 8 - firstFree);
    if (F === 0) continue;
    freeBitsTotal += F;
    const words = Math.ceil(F / 32);

    // rows[q] = which free bits feed block bit q (data bits then ECC bits).
    const blockBits = (D + bs.eccLen) * 8;
    const rows: Bitset[] = Array.from({ length: blockBits }, () => new Uint32Array(words));
    // ECC response to a 1 in data byte d (as a GF(256) vector).
    const unitResponse: Uint8Array[] = [];
    for (let d = 0; d < D; d++) {
      const unit = new Uint8Array(D);
      unit[d] = 1;
      unitResponse.push(rsRemainder(unit, divisor));
    }
    for (let f = 0; f < F; f++) {
      const q = firstFree + f;
      const d = q >>> 3;
      const v = 0x80 >>> (q & 7);
      rows[q][f >>> 5] |= 1 << (f & 31);
      const resp = unitResponse[d];
      for (let e = 0; e < bs.eccLen; e++) {
        const byte = gfMul(resp[e], v);
        if (!byte) continue;
        for (let b = 0; b < 8; b++) {
          if (byte & (0x80 >>> b)) {
            rows[(D + e) * 8 + b][f >>> 5] |= 1 << (f & 31);
          }
        }
      }
    }

    // Base bits for this block (free bits = 0).
    const blockData = data.subarray(bs.dataStart[j], bs.dataStart[j] + D);
    const baseEcc = rsRemainder(blockData, divisor);
    const baseBit = (q: number) => {
      const byte = q < D * 8 ? blockData[q >>> 3] : baseEcc[(q >>> 3) - D];
      return (byte >>> (7 - (q & 7))) & 1;
    };

    const basis = new Gf2Basis(F, words);
    const candidates = perBlock[j]
      .filter((c) => c.weight > 0)
      .sort((a, b) => b.weight - a.weight || a.moduleIdx - b.moduleIdx);
    for (const c of candidates) {
      if (basis.size === F) break;
      const x = c.moduleIdx % size;
      const y = Math.floor(c.moduleIdx / size);
      const m = maskBit(mask, x, y) ? 1 : 0;
      const rhs = target.want[c.moduleIdx] ^ m ^ baseBit(c.local);
      if (basis.add(rows[c.local], rhs)) pinned++;
    }
    const tie = opts.tieBreak;
    const solution = basis.solve((i) => (tie ? tie(j, i) : 0));
    for (let f = 0; f < F; f++) {
      if (solution[f >>> 5] & (1 << (f & 31))) {
        const g = start + firstFree + f;
        data[g >>> 3] ^= 0x80 >>> (g & 7);
      }
    }
  }

  const symbol = encodeSymbol({ payload, ecl, mask, version, mode, dataCodewords: data });

  // Remainder bits are ignored by decoders: paint them to the target.
  for (const moduleIdx of remainderModules) symbol.modules[moduleIdx] = target.want[moduleIdx];

  // Optional budgeted flips, counted per block by damaged codeword.
  const correctable = correctableCodewordsPerBlock(version, ecl);
  const budget = Math.min(1, Math.max(0, opts.errorBudget ?? 0));
  const allowed = Math.floor(budget * correctable);
  const damaged = new Array<number>(bs.numBlocks).fill(0);
  let flips = 0;
  if (allowed > 0) {
    const damagedCw = new Set<number>();
    const mismatched: { moduleIdx: number; cw: number; weight: number }[] = [];
    for (let s = 0; s < totalCodewordBits; s++) {
      const moduleIdx = lay.bitOrder[s];
      if (symbol.modules[moduleIdx] !== target.want[moduleIdx] && target.weight[moduleIdx] > 0) {
        mismatched.push({ moduleIdx, cw: s >>> 3, weight: target.weight[moduleIdx] });
      }
    }
    mismatched.sort((a, b) => b.weight - a.weight || a.moduleIdx - b.moduleIdx);
    for (const c of mismatched) {
      const j = bs.cwBlock[c.cw];
      if (!damagedCw.has(c.cw)) {
        if (damaged[j] >= allowed) continue;
        damagedCw.add(c.cw);
        damaged[j]++;
      }
      symbol.modules[c.moduleIdx] ^= 1;
      flips++;
    }
  }

  let wSum = 0;
  let wHit = 0;
  let hits = 0;
  for (let i = 0; i < size * size; i++) {
    const hit = symbol.modules[i] === target.want[i];
    if (hit) hits++;
    if (lay.isFunction[i]) continue;
    wSum += target.weight[i];
    if (hit) wHit += target.weight[i];
  }

  return {
    symbol,
    freeBits: freeBitsTotal,
    pinned,
    flips,
    damagedCodewords: damaged,
    correctableCodewords: new Array<number>(bs.numBlocks).fill(correctable),
    agreement: wSum > 0 ? wHit / wSum : 1,
    coverage: hits / (size * size),
  };
}

/** Synthesizes under all eight masks and returns them best-first. */
export function synthesizeAllMasks(
  opts: Omit<SynthesisOptions, "mask">,
  target: ModuleTarget
): SynthesisResult[] {
  const results: SynthesisResult[] = [];
  for (let mask = 0; mask < 8; mask++) results.push(synthesize({ ...opts, mask }, target));
  return results.sort((a, b) => b.agreement - a.agreement || a.symbol.mask - b.symbol.mask);
}
