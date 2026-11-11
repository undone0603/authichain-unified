// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  blockStructure,
  encodeSymbol,
  layout,
  minimumVersion,
  payloadBits,
  type Ecl,
} from "./encoder";
import { rsDivisor, rsRemainder } from "./gf256";
import { toGray } from "./perturb";
import { PALETTES, renderRaster } from "./render";
import { freeRegionStart, synthesize, synthesizeAllMasks, type ModuleTarget } from "./synthesis";
import { motif, moduleTarget, rng } from "./targets";
import { DEFAULT_DECODERS } from "./validate";

const URL = "https://authichain.com/qron/r/demo-123";

function decodeAll(modules: Uint8Array, version: number): (string | null)[] {
  const symbol = encodeSymbol({ payload: URL, ecl: "M", mask: 0, version });
  symbol.modules = modules;
  const raster = renderRaster(
    symbol,
    { shape: "square", finder: "square", palette: PALETTES[6], gradient: false, scale: 1 },
    { ppm: 4, supersample: 1 }
  );
  return DEFAULT_DECODERS.map((d) => d.decode(toGray(raster)));
}

function ringsTarget(version: number): ModuleTarget {
  return moduleTarget(motif("rings", 5), layout(version).size, { rand: rng(9) });
}

function weightedAgreement(modules: Uint8Array, target: ModuleTarget, version: number): number {
  const lay = layout(version);
  let w = 0;
  let hit = 0;
  for (let i = 0; i < modules.length; i++) {
    if (lay.isFunction[i]) continue;
    w += target.weight[i];
    if (modules[i] === target.want[i]) hit += target.weight[i];
  }
  return hit / w;
}

describe("qron-studio inverse synthesis", () => {
  it("pins every free bit to the artwork and still decodes to the exact payload", () => {
    for (const ecl of ["L", "M", "Q", "H"] as Ecl[]) {
      const version = minimumVersion(URL, ecl) + 2;
      const target = ringsTarget(version);
      const result = synthesize({ payload: URL, version, ecl, mask: 3 }, target);
      expect(result.freeBits).toBeGreaterThan(0);
      expect(result.pinned).toBe(result.freeBits);
      expect(result.flips).toBe(0);
      expect(decodeAll(result.symbol.modules, version)).toEqual([URL, URL]);
    }
  });

  it("beats the conventional encoding of the same symbol at resembling the target", () => {
    const version = minimumVersion(URL, "M") + 3;
    const target = ringsTarget(version);
    const synthesized = synthesize({ payload: URL, version, ecl: "M", mask: 2 }, target);
    const plain = encodeSymbol({ payload: URL, ecl: "M", mask: 2, version });
    expect(synthesized.agreement).toBeGreaterThan(weightedAgreement(plain.modules, target, version) + 0.1);
  });

  it("keeps the payload prefix and a valid Reed–Solomon code in every block", () => {
    const version = 6;
    const ecl: Ecl = "Q";
    const result = synthesize({ payload: URL, version, ecl, mask: 5 }, ringsTarget(version));
    const head = payloadBits(URL, "byte", version)!;
    const freeStart = freeRegionStart(URL, "byte", version, ecl);
    const data = result.symbol.dataCodewords;
    for (let i = 0; i < freeStart; i++) {
      const bit = (data[i >>> 3] >>> (7 - (i & 7))) & 1;
      expect(bit).toBe(i < head.length ? head[i] : 0); // payload, then the terminator
    }
    const bs = blockStructure(version, ecl);
    const divisor = rsDivisor(bs.eccLen);
    for (let n = 0; n < bs.cwBlock.length; n++) {
      const j = bs.cwBlock[n];
      const blockData = data.subarray(bs.dataStart[j], bs.dataStart[j] + bs.dataLen[j]);
      const idx = bs.cwIndex[n];
      const expected =
        idx < bs.dataLen[j] ? blockData[idx] : rsRemainder(blockData, divisor)[idx - bs.dataLen[j]];
      expect(result.symbol.codewords[n]).toBe(expected);
    }
  });

  it("spends no more error budget than allowed, per block", () => {
    const version = 7;
    const result = synthesize(
      { payload: URL, version, ecl: "Q", mask: 1, errorBudget: 0.5 },
      ringsTarget(version)
    );
    expect(result.flips).toBeGreaterThan(0);
    result.damagedCodewords.forEach((d, j) => {
      expect(d).toBeLessThanOrEqual(Math.floor(0.5 * result.correctableCodewords[j]));
    });
    expect(decodeAll(result.symbol.modules, version)).toEqual([URL, URL]);
  });

  it("keeps spec pad codewords in strict-padding mode", () => {
    const version = 6;
    const target = ringsTarget(version);
    const strict = synthesize({ payload: URL, version, ecl: "M", mask: 2, strictPadding: true }, target);
    const plain = encodeSymbol({ payload: URL, ecl: "M", mask: 2, version });
    expect(strict.freeBits).toBe(0);
    expect(Array.from(strict.symbol.dataCodewords)).toEqual(Array.from(plain.dataCodewords));
    const budgeted = synthesize(
      { payload: URL, version, ecl: "M", mask: 2, strictPadding: true, errorBudget: 0.5 },
      target
    );
    expect(budgeted.flips).toBeGreaterThan(0);
    expect(decodeAll(budgeted.symbol.modules, version)).toEqual([URL, URL]);
  });

  it("is deterministic", () => {
    const version = 5;
    const a = synthesizeAllMasks({ payload: URL, version, ecl: "M" }, ringsTarget(version));
    const b = synthesizeAllMasks({ payload: URL, version, ecl: "M" }, ringsTarget(version));
    expect(a.map((r) => r.symbol.mask)).toEqual(b.map((r) => r.symbol.mask));
    expect(Array.from(a[0].symbol.modules)).toEqual(Array.from(b[0].symbol.modules));
    expect(a[0].agreement).toBeGreaterThanOrEqual(a[7].agreement);
  });
});
