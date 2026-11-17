// @vitest-environment node
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import {
  addEccAndInterleave,
  blockStructure,
  chooseMode,
  correctableCodewordsPerBlock,
  encodeSymbol,
  formatBits,
  layout,
  minimumVersion,
  numDataCodewords,
  numEccBlocks,
  type Ecl,
} from "./encoder";
import { rsDivisor, rsRemainder } from "./gf256";
import { renderRaster, PALETTES } from "./render";
import { toGray } from "./perturb";
import { DEFAULT_DECODERS } from "./validate";

const URL = "https://authichain.com/qron/r/demo-123";

function decodeAll(symbol: ReturnType<typeof encodeSymbol>): (string | null)[] {
  const raster = renderRaster(
    symbol,
    { shape: "square", finder: "square", palette: PALETTES[6], gradient: false, scale: 1 },
    { ppm: symbol.version > 20 ? 3 : 4, supersample: 1 }
  );
  const gray = toGray(raster);
  return DEFAULT_DECODERS.map((d) => d.decode(gray));
}

describe("qron-studio encoder", () => {
  it("matches ISO/IEC 18004 data capacities", () => {
    expect(numDataCodewords(1, "L")).toBe(19);
    expect(numDataCodewords(1, "M")).toBe(16);
    expect(numDataCodewords(1, "Q")).toBe(13);
    expect(numDataCodewords(1, "H")).toBe(9);
    expect(numDataCodewords(10, "M")).toBe(216);
    expect(numDataCodewords(40, "L")).toBe(2956);
    expect(numDataCodewords(40, "H")).toBe(1276);
    // Byte-mode capacity: 17 chars at 1-L, 2953 at 40-L.
    expect(minimumVersion("x".repeat(17), "L", "byte")).toBe(1);
    expect(minimumVersion("x".repeat(18), "L", "byte")).toBe(2);
    expect(minimumVersion("x".repeat(2953), "L", "byte")).toBe(40);
    expect(() => minimumVersion("x".repeat(2954), "L", "byte")).toThrow("payload_too_long");
  });

  it("produces the standard format-information words", () => {
    expect(formatBits("M", 0)).toBe(0x5412);
    expect(formatBits("L", 0)).toBe(0x77c4);
    expect(formatBits("Q", 0)).toBe(0x355f);
    expect(formatBits("H", 0)).toBe(0x1689);
  });

  it("picks the densest mode for the payload", () => {
    expect(chooseMode("0123456789")).toBe("numeric");
    expect(chooseMode("HTTPS://AUTHICHAIN.COM/01/09506000134352")).toBe("alphanumeric");
    expect(chooseMode(URL)).toBe("byte");
  });

  it("is module-for-module identical to the qrcode library", () => {
    for (const ecl of ["L", "M", "Q", "H"] as Ecl[]) {
      for (const version of [1, 2, 7, 10, 23]) {
        if (version < minimumVersion(URL, ecl, "byte")) continue;
        for (const mask of [0, 3, 6]) {
          const ours = encodeSymbol({ payload: URL, ecl, mask, version, mode: "byte" });
          const ref = QRCode.create([{ data: new TextEncoder().encode(URL), mode: "byte" }], {
            version,
            errorCorrectionLevel: ecl,
            maskPattern: mask as QRCode.QRCodeMaskPattern,
          });
          expect(ref.modules.size).toBe(ours.size);
          expect(Array.from(ref.modules.data)).toEqual(Array.from(ours.modules));
        }
      }
    }
  });

  it("decodes to the exact payload on both decoders across versions, levels and masks", () => {
    const ALNUM = "HTTPS://AUTHICHAIN.COM/01/09506000134352";
    const payloads = [URL, ALNUM, "0123456789012345", "Authentic ✓ économie"];
    for (const payload of payloads) {
      for (const ecl of ["L", "M", "Q", "H"] as Ecl[]) {
        const vmin = minimumVersion(payload, ecl);
        for (const [version, mask] of [
          [vmin, 0],
          [vmin + 1, 5],
          [Math.max(vmin, 9), 7],
        ]) {
          const symbol = encodeSymbol({ payload, ecl, mask, version });
          const [jsqr, zxing] = decodeAll(symbol);
          expect(jsqr).toBe(payload);
          // Known decoder limitation, not an encoding defect: this symbol is
          // identical to the qrcode library's output and ZXing (0.21.3) decodes
          // it with PURE_BARCODE, but its finder detector misses it. This is
          // the failure class scanner-in-the-loop validation exists to catch.
          const zxingDetectorMiss = payload === ALNUM && ecl === "H" && version === 9 && mask === 7;
          if (!zxingDetectorMiss) expect(zxing).toBe(payload);
        }
      }
    }
  });

  it("decodes the largest symbol (version 40-H)", () => {
    const payload = "A".repeat(1800);
    const symbol = encodeSymbol({ payload, ecl: "H", mask: 2, version: 40 });
    expect(symbol.size).toBe(177);
    expect(decodeAll(symbol)[0]).toBe(payload);
  });

  it("maps every interleaved codeword back to its Reed–Solomon block", () => {
    for (const [version, ecl] of [
      [5, "Q"],
      [13, "M"],
      [40, "L"],
    ] as [number, Ecl][]) {
      const bs = blockStructure(version, ecl);
      expect(bs.numBlocks).toBe(numEccBlocks(version, ecl));
      const data = new Uint8Array(numDataCodewords(version, ecl)).map((_, i) => (i * 37 + 11) & 0xff);
      const interleaved = addEccAndInterleave(data, version, ecl);
      const divisor = rsDivisor(bs.eccLen);
      for (let n = 0; n < interleaved.length; n++) {
        const j = bs.cwBlock[n];
        const idx = bs.cwIndex[n];
        const blockData = data.subarray(bs.dataStart[j], bs.dataStart[j] + bs.dataLen[j]);
        const expected =
          idx < bs.dataLen[j] ? blockData[idx] : rsRemainder(blockData, divisor)[idx - bs.dataLen[j]];
        expect(interleaved[n]).toBe(expected);
      }
    }
  });

  it("places every raw data module exactly once", () => {
    for (const version of [1, 6, 7, 32, 40]) {
      const lay = layout(version);
      const seen = new Set(lay.bitOrder);
      expect(seen.size).toBe(lay.bitOrder.length);
      for (const idx of lay.bitOrder) expect(lay.isFunction[idx]).toBe(0);
    }
  });

  it("nets misdecode protection out of the correction budget", () => {
    expect(correctableCodewordsPerBlock(1, "L")).toBe(2);
    expect(correctableCodewordsPerBlock(1, "M")).toBe(4);
    expect(correctableCodewordsPerBlock(5, "Q")).toBe(9);
  });
});
