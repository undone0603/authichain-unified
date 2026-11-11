// @vitest-environment node
import { describe, expect, it } from "vitest";
import { encodeSymbol, layout } from "./encoder";
import { encodePng } from "./png";
import { PALETTES, renderRaster, renderSvg, type DesignStyle } from "./render";
import { runStudio, SHAPE_MENU } from "./studio";
import { luminance, motif } from "./targets";
import { validateRaster } from "./validate";

const URL = "https://authichain.com/qron/r/demo-123";

const style = (over: Partial<DesignStyle> = {}): DesignStyle => ({
  shape: "square",
  finder: "square",
  palette: PALETTES[0],
  gradient: false,
  scale: 1,
  ...over,
});

describe("qron-studio palettes and rendering", () => {
  it("keeps every palette above the contrast floor", () => {
    for (const p of PALETTES) {
      expect(luminance(p.light)).toBeGreaterThanOrEqual(0.85);
      expect(luminance(p.dark)).toBeLessThanOrEqual(0.2);
      expect(luminance(p.dark2)).toBeLessThanOrEqual(0.2);
    }
  });

  it("renders every shape and finder style to a clean, exact decode", () => {
    const symbol = encodeSymbol({ payload: URL, ecl: "Q", mask: 4, version: 6 });
    const field = motif("waves", 2);
    for (const shape of SHAPE_MENU) {
      for (const finder of ["square", "rounded", "orb"] as const) {
        const raster = renderRaster(symbol, style({ ...shape, finder }), { ppm: 8, field });
        const report = validateRaster(raster, URL, {
          ppm: 8,
          conditions: [{ id: "clean", label: "clean", required: true, apply: (img) => img }],
        });
        expect(report.pass, `${shape.shape}/${finder}`).toBe(true);
      }
    }
  });

  it("rejects a design that decodes to a different payload", () => {
    const other = encodeSymbol({ payload: `${URL}-x`, ecl: "M", mask: 1 });
    const report = validateRaster(renderRaster(other, style(), { ppm: 8 }), URL, { ppm: 8 });
    expect(report.pass).toBe(false);
    expect(report.failures[0]).toContain("payload mismatch");
  });

  it("rejects a symbol damaged beyond its error correction", () => {
    const symbol = encodeSymbol({ payload: URL, ecl: "L", mask: 2, version: 3 });
    const lay = layout(3);
    let n = 0;
    for (const idx of lay.bitOrder) if (n++ % 3 === 0) symbol.modules[idx] ^= 1;
    const report = validateRaster(renderRaster(symbol, style(), { ppm: 8 }), URL, { ppm: 8, failFast: true });
    expect(report.pass).toBe(false);
  });

  it("writes SVG with the same protected geometry", () => {
    const symbol = encodeSymbol({ payload: URL, ecl: "M", mask: 0, version: 4 });
    const svg = renderSvg(symbol, style({ shape: "liquid", finder: "rounded", gradient: true }));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="-4 -4 41 41"');
    expect(svg).toContain("linearGradient");
  });

  it("encodes PNGs with a valid signature and IHDR", () => {
    const raster = renderRaster(encodeSymbol({ payload: URL, ecl: "M", mask: 0 }), style(), { ppm: 2 });
    const png = encodePng(raster);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(raster.width);
    expect(png.readUInt32BE(20)).toBe(raster.height);
  });
});

describe("qron-studio orchestration", () => {
  it("accepts only designs that pass the gate, ranked and reproducible", () => {
    const opts = { payload: URL, count: 3, seed: 11, maxCandidates: 8, ppm: 8 };
    const a = runStudio(opts);
    const b = runStudio(opts);
    expect(a.accepted.length).toBe(3);
    expect(a.accepted.map((d) => d.rank)).toEqual([1, 2, 3]);
    for (const d of a.accepted) {
      expect(d.validation.pass).toBe(true);
      for (const r of d.validation.results.filter((x) => x.required)) {
        for (const outcome of Object.values(r.decoders)) {
          expect(outcome.ok).toBe(true);
          expect(outcome.text).toBe(URL);
        }
      }
    }
    for (let i = 1; i < a.accepted.length; i++) {
      expect(a.accepted[i - 1].scores.composite).toBeGreaterThanOrEqual(a.accepted[i].scores.composite);
    }
    expect(b.accepted.map((d) => [d.id, d.scores.composite])).toEqual(
      a.accepted.map((d) => [d.id, d.scores.composite])
    );
    for (const r of a.rejected) expect(r.rejection).toBeTruthy();
  });
});
