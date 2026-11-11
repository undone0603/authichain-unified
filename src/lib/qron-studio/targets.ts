/**
 * Target artwork for inverse synthesis.
 *
 * A target is a continuous luminance field over the whole canvas (symbol
 * plus quiet zone) in normalized coordinates u, v ∈ [0, 1]. 0 is dark and
 * 1 is light. Procedural motifs are seeded and deterministic. Image targets
 * wrap a decoded RGBA bitmap.
 */

import type { ModuleTarget } from "./synthesis";

export type Rgb = [number, number, number];

export type TargetField = {
  id: string;
  label: string;
  params: Record<string, number>;
  luma(u: number, v: number): number;
  /** native colour, for image targets; procedural motifs use the palette */
  color?(u: number, v: number): Rgb;
};

/** mulberry32: small, fast, deterministic PRNG in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Relative luminance (Rec. 601 weights) of an sRGB colour, 0..1. */
export function luminance([r, g, b]: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

type MotifFactory = (rand: () => number) => Omit<TargetField, "id">;

const between = (rand: () => number, lo: number, hi: number) => lo + (hi - lo) * rand();

export const MOTIFS: Record<string, MotifFactory> = {
  rings(rand) {
    const cx = between(rand, 0.42, 0.58);
    const cy = between(rand, 0.42, 0.58);
    const freq = between(rand, 2.4, 4.4);
    const phase = between(rand, 0, TAU);
    return {
      label: "Concentric rings",
      params: { cx, cy, freq, phase },
      luma: (u, v) => 0.5 + 0.5 * Math.cos(TAU * freq * Math.hypot(u - cx, v - cy) + phase),
    };
  },
  spiral(rand) {
    const arms = 2 + Math.floor(rand() * 4);
    const twist = between(rand, 3.5, 8);
    const dir = rand() < 0.5 ? -1 : 1;
    return {
      label: "Spiral galaxy",
      params: { arms, twist, dir },
      luma: (u, v) => {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const r = Math.hypot(dx, dy);
        const core = smooth(0.06, 0.12, r);
        const arm = 0.5 + 0.5 * Math.cos(arms * Math.atan2(dy, dx) + dir * twist * TAU * r);
        return core * arm + (1 - core) * 0.95;
      },
    };
  },
  waves(rand) {
    const bands = between(rand, 3, 5.5);
    const amp = between(rand, 0.04, 0.09);
    const freq = between(rand, 1, 2.5);
    const phase = between(rand, 0, TAU);
    return {
      label: "Ocean waves",
      params: { bands, amp, freq, phase },
      luma: (u, v) =>
        0.5 + 0.5 * Math.sin(TAU * bands * (v + amp * Math.sin(TAU * freq * u + phase))),
    };
  },
  sunrise(rand) {
    const horizon = between(rand, 0.56, 0.66);
    const sx = between(rand, 0.38, 0.62);
    const radius = between(rand, 0.11, 0.17);
    return {
      label: "Sunrise over water",
      params: { horizon, sx, radius },
      luma: (u, v) => {
        if (v < horizon) {
          const sky = 0.12 + 0.6 * Math.pow(v / horizon, 1.6);
          const r = Math.hypot(u - sx, v - (horizon - radius * 0.35));
          const sun = 1 - smooth(radius * 0.92, radius * 1.05, r);
          return Math.max(sky, sun * 0.97);
        }
        const depth = (v - horizon) / (1 - horizon);
        const width = radius * (0.8 + depth * 0.9);
        const glint = Math.sin(TAU * 18 * v) > -0.2 ? 1 : 0;
        const reflection = (1 - smooth(width * 0.75, width, Math.abs(u - sx))) * glint;
        return Math.max(0.14 + 0.1 * depth, reflection * 0.9);
      },
    };
  },
  mountains(rand) {
    const base = between(rand, 0.5, 0.6);
    const a1 = between(rand, 0.06, 0.12);
    const f1 = between(rand, 1, 2);
    const p1 = between(rand, 0, TAU);
    const a2 = between(rand, 0.02, 0.05);
    const f2 = between(rand, 3, 6);
    const p2 = between(rand, 0, TAU);
    const mx = between(rand, 0.25, 0.75);
    return {
      label: "Mountain range under a moon",
      params: { base, a1, f1, p1, a2, f2, p2, mx },
      luma: (u, v) => {
        const ridge =
          base - a1 * Math.abs(Math.sin(TAU * f1 * u + p1)) - a2 * Math.sin(TAU * f2 * u + p2);
        const land = smooth(ridge - 0.012, ridge + 0.012, v);
        const mist = 0.12 + 0.18 * smooth(0.1, 0.9, Math.sin(TAU * 7 * (v - ridge)) * 0.5 + 0.5);
        const moon = 1 - smooth(0.085, 0.1, Math.hypot(u - mx, v - 0.2));
        const bite = 1 - smooth(0.07, 0.085, Math.hypot(u - mx - 0.04, v - 0.18));
        const sky = 0.88 - 0.7 * moon * (1 - bite);
        return sky * (1 - land) + mist * land;
      },
    };
  },
  monogram(rand) {
    const r = between(rand, 0.25, 0.3);
    const stroke = between(rand, 0.065, 0.085);
    const tail = between(rand, 0.16, 0.22);
    return {
      label: "QRON monogram",
      params: { r, stroke, tail },
      luma: (u, v) => {
        const ring = Math.abs(Math.hypot(u - 0.5, v - 0.48) - r) - stroke / 2;
        // Tail: capsule from the lower-right of the ring outward.
        const ax = 0.5 + r * 0.55;
        const ay = 0.48 + r * 0.55;
        const bx = ax + tail * 0.75;
        const by = ay + tail * 0.75;
        const t = clamp01(((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2));
        const capsule = Math.hypot(u - ax - t * (bx - ax), v - ay - t * (by - ay)) - stroke / 2;
        const d = Math.min(ring, capsule);
        return smooth(-0.01, 0.01, d) * 0.85 + 0.1;
      },
    };
  },
  orbit(rand) {
    const tilt = between(rand, -0.6, 0.6);
    const pr = between(rand, 0.13, 0.18);
    return {
      label: "Planet in orbit",
      params: { tilt, pr },
      luma: (u, v) => {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const planet = 1 - smooth(pr - 0.01, pr + 0.01, Math.hypot(dx, dy));
        const c = Math.cos(tilt);
        const s = Math.sin(tilt);
        const ex = (dx * c + dy * s) / 0.36;
        const ey = (-dx * s + dy * c) / 0.11;
        const ring = 1 - smooth(0.08, 0.16, Math.abs(Math.hypot(ex, ey) - 1));
        const front = ey > 0 || Math.hypot(dx, dy) > pr ? ring : 0;
        return 0.9 - 0.78 * Math.max(planet, front);
      },
    };
  },
  lattice(rand) {
    const k = between(rand, 2.2, 3.8);
    const skew = between(rand, -0.15, 0.15);
    return {
      label: "Argyle lattice",
      params: { k, skew },
      luma: (u, v) =>
        0.5 + 0.5 * Math.cos(TAU * k * (u + v + skew * u)) * Math.cos(TAU * k * (u - v)),
    };
  },
  eye(rand) {
    const open = between(rand, 0.2, 0.26);
    const iris = between(rand, 0.12, 0.16);
    return {
      label: "Watchful eye",
      params: { open, iris },
      luma: (u, v) => {
        const lid = open * Math.sin(Math.PI * clamp01((u - 0.12) / 0.76));
        const inside = 1 - smooth(lid - 0.012, lid + 0.012, Math.abs(v - 0.5));
        const r = Math.hypot(u - 0.5, v - 0.5);
        const irisMask = 1 - smooth(iris - 0.01, iris + 0.01, r);
        const glint = 1 - smooth(0.025, 0.035, Math.hypot(u - 0.46, v - 0.46));
        const sclera = 0.92 - 0.82 * irisMask + 0.8 * glint * irisMask;
        return inside * sclera + (1 - inside) * 0.12;
      },
    };
  },
};

export const MOTIF_IDS = Object.keys(MOTIFS);

export function motif(id: string, seed: number): TargetField {
  const factory = MOTIFS[id];
  if (!factory) throw new Error(`unknown_motif:${id}`);
  const built = factory(rng(seed));
  const params: Record<string, number> = { seed };
  for (const [k, val] of Object.entries(built.params)) params[k] = round3(val);
  return { id, ...built, params };
}

/** Wraps an RGBA bitmap (row-major, 4 bytes per pixel) as a target. */
export function imageTarget(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  id = "image"
): TargetField {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = luminance([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
  }
  const sample = (u: number, v: number, read: (i: number) => number) => {
    const x = clamp01(u) * (width - 1);
    const y = clamp01(v) * (height - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const top = read(y0 * width + x0) * (1 - fx) + read(y0 * width + x1) * fx;
    const bot = read(y1 * width + x0) * (1 - fx) + read(y1 * width + x1) * fx;
    return top * (1 - fy) + bot * fy;
  };
  return {
    id,
    label: "Supplied artwork",
    params: { width, height },
    luma: (u, v) => sample(u, v, (i) => lum[i]),
    color: (u, v) => [
      sample(u, v, (i) => rgba[i * 4]),
      sample(u, v, (i) => rgba[i * 4 + 1]),
      sample(u, v, (i) => rgba[i * 4 + 2]),
    ],
  };
}

export type ModuleTargetOptions = {
  quiet?: number;
  /** share of priority given to edges vs. tonal contrast (0..1) */
  edgeWeight?: number;
  /** extra priority toward the symbol centre (0..1) */
  centerWeight?: number;
  /** multiplicative priority jitter for variety (0..1) */
  jitter?: number;
  rand?: () => number;
};

/** Samples a field per module and derives the synthesis priority map. */
export function moduleTarget(
  field: TargetField,
  size: number,
  opts: ModuleTargetOptions = {}
): ModuleTarget & { luma: Float32Array } {
  const quiet = opts.quiet ?? 4;
  const edgeWeight = opts.edgeWeight ?? 0.35;
  const centerWeight = opts.centerWeight ?? 0.25;
  const jitter = opts.jitter ?? 0;
  const rand = opts.rand ?? Math.random;
  const span = size + quiet * 2;
  const luma = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          acc += field.luma((x + quiet + (sx + 0.5) / 3) / span, (y + quiet + (sy + 0.5) / 3) / span);
        }
      }
      luma[y * size + x] = acc / 9;
    }
  }
  const at = (x: number, y: number) =>
    luma[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))];
  const want = new Uint8Array(size * size);
  const weight = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      want[i] = luma[i] < 0.5 ? 1 : 0;
      const contrast = Math.abs(luma[i] - 0.5) * 2;
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      const edge = Math.min(1, Math.hypot(gx, gy));
      const r = Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2) / (size / 2);
      const center = 1 - centerWeight * Math.min(1, r);
      const j = 1 + jitter * (rand() - 0.5);
      weight[i] = (0.02 + (1 - edgeWeight) * contrast + edgeWeight * edge) * center * j;
    }
  }
  return { want, weight, luma };
}
