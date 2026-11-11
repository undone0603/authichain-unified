/**
 * QRON Studio orchestration: explore the design space, synthesize, render,
 * validate, then rank what survives.
 *
 *   payload ─▶ version / ECL ─▶ inverse synthesis × 8 masks ─▶ style
 *          ─▶ raster ─▶ scanner-in-the-loop validation ─▶ accept | reject
 *
 * Everything is a pure function of (options, seed). The same inputs give
 * the same designs, byte for byte.
 */

import { layout, minimumVersion, penaltyScore, MAX_VERSION, type Ecl, type QrSymbol } from "./encoder";
import { PALETTES, renderRaster, type DesignStyle, type FinderStyle, type Palette, type Raster } from "./render";
import { synthesizeAllMasks } from "./synthesis";
import { MOTIF_IDS, moduleTarget, motif, rng, type TargetField } from "./targets";
import {
  DEFAULT_CONDITIONS,
  DEFAULT_DECODERS,
  validateRaster,
  type QrDecoder,
  type ScanCondition,
  type ValidationReport,
} from "./validate";
import { downscale, toGray } from "./perturb";

export const STUDIO_VERSION = "qron-studio/0.1.0";

export type ShapeSpec = Pick<DesignStyle, "shape" | "scale" | "blend">;

export const SHAPE_MENU: readonly ShapeSpec[] = [
  { shape: "square", scale: 1 },
  { shape: "liquid", scale: 1 },
  { shape: "dot", scale: 0.86 },
  { shape: "diamond", scale: 0.9 },
  { shape: "halftone", scale: 0.5, blend: 0.35 },
  { shape: "halftone", scale: 0.6, blend: 0.4 },
];

export const FINDER_MENU: readonly FinderStyle[] = ["square", "rounded", "orb"];

/** Weights of the composite ranking score. Documented in the README. */
export const SCORE_WEIGHTS = { visual: 0.5, robustness: 0.5, agreement: 0.5, fidelity: 0.5 } as const;

export type StudioOptions = {
  payload: string;
  /** accepted designs wanted */
  count?: number;
  seed?: number;
  /** hard cap on candidates tried (default 3 × count) */
  maxCandidates?: number;
  ecls?: readonly Ecl[];
  /** versions explored above the minimum that fits the payload */
  versionSpan?: number;
  motifs?: readonly string[];
  /** use this artwork for every design instead of procedural motifs */
  image?: TargetField | null;
  shapes?: readonly ShapeSpec[];
  finders?: readonly FinderStyle[];
  palettes?: readonly Palette[];
  /** error-budget fractions to sample from (0 keeps full ECC margin) */
  errorBudgets?: readonly number[];
  /** keep spec pad codewords; no art bits after the terminator */
  strictPadding?: boolean;
  /** pixels per module of the validated (and exported) raster */
  ppm?: number;
  conditions?: readonly ScanCondition[];
  decoders?: readonly QrDecoder[];
  onProgress?: (event: StudioProgress) => void;
};

export type StudioProgress = {
  candidate: number;
  accepted: number;
  rejected: number;
  design: DesignRecord;
};

export type DesignParams = {
  version: number;
  ecl: Ecl;
  mask: number;
  mode: string;
  errorBudget: number;
  strictPadding: boolean;
  target: { id: string; label: string; params: Record<string, number> };
  palette: string;
  shape: string;
  scale: number;
  blend: number;
  finder: FinderStyle;
  gradient: boolean;
};

export type DesignRecord = {
  id: string;
  index: number;
  status: "accepted" | "rejected";
  rank: number | null;
  params: DesignParams;
  synthesis: {
    freeBits: number;
    pinned: number;
    flips: number;
    damagedCodewords: number[];
    correctableCodewords: number[];
    agreement: number;
    coverage: number;
    penalty: number;
    /** weighted agreement for masks 0..7 (artistic mask optimization) */
    maskAgreements: number[];
  };
  validation: ValidationReport;
  scores: { visual: number; fidelity: number; robustness: number; composite: number };
  rejection: string | null;
  symbol: QrSymbol;
  style: DesignStyle;
  field: TargetField;
  raster: Raster | null;
};

export type StudioRun = {
  generator: string;
  payload: string;
  seed: number;
  requested: number;
  candidates: number;
  accepted: DesignRecord[];
  rejected: DesignRecord[];
  conditions: { id: string; label: string; required: boolean }[];
  decoders: string[];
};

/** FNV-1a over module values: identity of the module pattern. */
export function matrixKey(symbol: QrSymbol): string {
  let h = 0x811c9dc5;
  for (const m of symbol.modules) {
    h ^= m;
    h = Math.imul(h, 0x01000193);
  }
  return `${symbol.version}${symbol.ecl}${symbol.mask}:${(h >>> 0).toString(16)}`;
}

/**
 * How closely the rendered design resembles the target at viewing scale:
 * 1 − mean |render − target| over a 48 × 48 grid of the symbol area, with
 * the render's luminance normalized to [0, 1].
 */
export function renderFidelity(raster: Raster, field: TargetField, size: number, quiet: number): number {
  const G = 48;
  const span = size + quiet * 2;
  const gray = downscale(toGray(raster), G / raster.width);
  let lo = 255;
  let hi = 0;
  for (const v of gray.data) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = Math.max(1, hi - lo);
  let err = 0;
  let n = 0;
  for (let y = 0; y < gray.height; y++) {
    for (let x = 0; x < gray.width; x++) {
      const u = (x + 0.5) / gray.width;
      const v = (y + 0.5) / gray.height;
      const mx = u * span - quiet;
      const my = v * span - quiet;
      if (mx < 0 || my < 0 || mx >= size || my >= size) continue;
      err += Math.abs((gray.data[y * gray.width + x] - lo) / range - field.luma(u, v));
      n++;
    }
  }
  return n > 0 ? 1 - err / n : 0;
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

export function runStudio(opts: StudioOptions): StudioRun {
  const count = opts.count ?? 100;
  const seed = opts.seed ?? 1;
  const maxCandidates = opts.maxCandidates ?? count * 3;
  const ecls = opts.ecls ?? (["M", "Q"] as const);
  const versionSpan = opts.versionSpan ?? 3;
  const motifs = opts.motifs ?? MOTIF_IDS;
  const shapes = opts.shapes ?? SHAPE_MENU;
  const finders = opts.finders ?? FINDER_MENU;
  const palettes = opts.palettes ?? PALETTES;
  const budgets = opts.errorBudgets ?? [0, 0, 0.25];
  const ppm = opts.ppm ?? 10;
  const conditions = opts.conditions ?? DEFAULT_CONDITIONS;
  const decoders = opts.decoders ?? DEFAULT_DECODERS;
  const quiet = 4;
  if (!opts.payload) throw new Error("payload_required");

  const accepted: DesignRecord[] = [];
  const rejected: DesignRecord[] = [];
  const seen = new Set<string>();
  let candidates = 0;

  for (let i = 0; i < maxCandidates && accepted.length < count; i++) {
    const rand = rng(seed * 1_000_003 + i);
    const field = opts.image ?? motif(motifs[i % motifs.length], seed * 10_007 + i);
    const ecl = pick(rand, ecls);
    const vmin = minimumVersion(opts.payload, ecl);
    const version = Math.min(MAX_VERSION, vmin + Math.floor(rand() * (versionSpan + 1)));
    const errorBudget = pick(rand, budgets);
    const shape = pick(rand, shapes);
    const style: DesignStyle = {
      shape: shape.shape,
      scale: shape.scale,
      blend: shape.blend,
      finder: pick(rand, finders),
      palette: pick(rand, palettes),
      gradient: rand() < 0.5,
    };
    const size = layout(version).size;
    const target = moduleTarget(field, size, { quiet, jitter: 0.3, rand });
    const byMask = synthesizeAllMasks(
      { payload: opts.payload, version, ecl, errorBudget, strictPadding: opts.strictPadding },
      target
    );
    const best = byMask[0];
    const maskAgreements = new Array<number>(8);
    for (const r of byMask) maskAgreements[r.symbol.mask] = round4(r.agreement);

    const key = `${matrixKey(best.symbol)}|${style.palette.id}|${style.shape}|${style.scale}|${style.finder}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates++;

    const raster = renderRaster(best.symbol, style, { ppm, quiet, field });
    const validation = validateRaster(raster, opts.payload, {
      ppm,
      conditions,
      decoders,
      seed: seed * 31 + i,
      failFast: true,
    });
    const fidelity = renderFidelity(raster, field, size, quiet);
    const visual = SCORE_WEIGHTS.agreement * best.agreement + SCORE_WEIGHTS.fidelity * fidelity;
    const composite = SCORE_WEIGHTS.visual * visual + SCORE_WEIGHTS.robustness * validation.robustness;

    const record: DesignRecord = {
      id: `qron-${seed}-${String(i).padStart(4, "0")}`,
      index: i,
      status: validation.pass ? "accepted" : "rejected",
      rank: null,
      params: {
        version,
        ecl,
        mask: best.symbol.mask,
        mode: best.symbol.mode,
        errorBudget,
        strictPadding: !!opts.strictPadding,
        target: { id: field.id, label: field.label, params: field.params },
        palette: style.palette.id,
        shape: style.shape,
        scale: style.scale,
        blend: style.blend ?? 0,
        finder: style.finder,
        gradient: style.gradient,
      },
      synthesis: {
        freeBits: best.freeBits,
        pinned: best.pinned,
        flips: best.flips,
        damagedCodewords: best.damagedCodewords,
        correctableCodewords: best.correctableCodewords,
        agreement: round4(best.agreement),
        coverage: round4(best.coverage),
        penalty: penaltyScore(best.symbol.modules, best.symbol.size),
        maskAgreements,
      },
      validation,
      scores: {
        visual: round4(visual),
        fidelity: round4(fidelity),
        robustness: round4(validation.robustness),
        composite: round4(composite),
      },
      rejection: validation.pass
        ? null
        : validation.failures.filter((f) => conditions.find((c) => f.startsWith(`${c.id}/`))?.required).join("; "),
      symbol: best.symbol,
      style,
      field,
      raster: validation.pass ? raster : null,
    };
    (validation.pass ? accepted : rejected).push(record);
    opts.onProgress?.({ candidate: candidates, accepted: accepted.length, rejected: rejected.length, design: record });
  }

  accepted.sort((a, b) => b.scores.composite - a.scores.composite || a.index - b.index);
  accepted.forEach((d, k) => (d.rank = k + 1));

  return {
    generator: STUDIO_VERSION,
    payload: opts.payload,
    seed,
    requested: count,
    candidates,
    accepted,
    rejected,
    conditions: conditions.map(({ id, label, required }) => ({ id, label, required })),
    decoders: decoders.map((d) => d.name),
  };
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

/** Module matrix as rows of "0"/"1", for reports and reproducibility. */
export function matrixRows(symbol: QrSymbol): string[] {
  const rows: string[] = [];
  for (let y = 0; y < symbol.size; y++) {
    rows.push(Array.from(symbol.modules.subarray(y * symbol.size, (y + 1) * symbol.size)).join(""));
  }
  return rows;
}

/** JSON-safe view of a design (no rasters, no closures). */
export function designSummary(d: DesignRecord) {
  return {
    id: d.id,
    rank: d.rank,
    status: d.status,
    rejection: d.rejection,
    params: d.params,
    synthesis: d.synthesis,
    scores: d.scores,
    validation: {
      pass: d.validation.pass,
      robustness: d.validation.robustness,
      truncated: d.validation.truncated,
      failures: d.validation.failures,
      results: d.validation.results.map((r) => ({
        id: r.id,
        required: r.required,
        decoders: Object.fromEntries(Object.entries(r.decoders).map(([k, v]) => [k, v.ok])),
      })),
    },
    matrix: matrixRows(d.symbol),
  };
}
