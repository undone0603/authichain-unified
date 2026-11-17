/**
 * Validation engine. Each design is captured under a set of simulated scan
 * conditions and read by independent decoders. A read passes only when it
 * returns the exact intended payload. A design ships only when every
 * required condition passes on every decoder. Beauty alone never passes.
 */

import jsQR from "jsqr";
import * as zxingModule from "@zxing/library";
import {
  addNoise,
  compressContrast,
  downscale,
  gaussianBlur,
  grayToBytes,
  grayToRgba,
  perspective,
  rotate,
  toGray,
  unevenLight,
  type Gray,
} from "./perturb";
import type { Raster } from "./render";
import { rng } from "./targets";

export type QrDecoder = {
  name: string;
  decode(img: Gray): string | null;
};

// @zxing/library's "main" is CommonJS; Node's ESM loader exposes it only as
// a default export, while bundlers resolve the ESM build with named exports.
const ZX: typeof zxingModule =
  (zxingModule as unknown as { default?: typeof zxingModule }).default ?? zxingModule;

export const jsqrDecoder: QrDecoder = {
  name: "jsqr",
  decode(img) {
    const r = jsQR(grayToRgba(img), img.width, img.height, { inversionAttempts: "dontInvert" });
    return r ? r.data : null;
  },
};

export function zxingDecoder(tryHarder = false): QrDecoder {
  const hints = new Map<zxingModule.DecodeHintType, unknown>();
  if (tryHarder) hints.set(ZX.DecodeHintType.TRY_HARDER, true);
  return {
    name: tryHarder ? "zxing-tryharder" : "zxing",
    decode(img) {
      try {
        const source = new ZX.RGBLuminanceSource(grayToBytes(img), img.width, img.height);
        const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(source));
        const result = new ZX.QRCodeReader().decode(bitmap, hints);
        return result.getText();
      } catch {
        return null;
      }
    },
  };
}

export const DEFAULT_DECODERS: readonly QrDecoder[] = [jsqrDecoder, zxingDecoder()];

export type ConditionContext = { ppm: number; rand: () => number };

export type ScanCondition = {
  id: string;
  label: string;
  required: boolean;
  apply(img: Gray, ctx: ConditionContext): Gray;
};

/** Background tone outside the printed code (a desk, a box, a wall). */
const SURROUND = 205;

export const DEFAULT_CONDITIONS: readonly ScanCondition[] = [
  { id: "clean", label: "Clean render", required: true, apply: (img) => img },
  {
    id: "print-small",
    label: "Small print / distance (≈3 px per module)",
    required: true,
    apply: (img, { ppm }) => downscale(img, 3 / ppm),
  },
  {
    id: "defocus",
    label: "Defocus blur (σ = 0.3 module)",
    required: true,
    apply: (img, { ppm }) => gaussianBlur(img, 0.3 * ppm),
  },
  {
    id: "rotate",
    label: "Rotated 17°",
    required: true,
    apply: (img) => rotate(img, 17, SURROUND),
  },
  {
    id: "perspective",
    label: "Perspective tilt (keystone 14%)",
    required: true,
    apply: (img) => perspective(img, 0.14, SURROUND),
  },
  {
    id: "uneven-light",
    label: "Uneven light (55% falloff + shadow band)",
    required: true,
    apply: (img) => unevenLight(img, 0.55, 0.6),
  },
  {
    id: "sensor-noise",
    label: "Sensor noise (σ = 14)",
    required: false,
    apply: (img, { rand }) => addNoise(img, 14, rand),
  },
  {
    id: "low-contrast",
    label: "Faded print (contrast 70→190)",
    required: false,
    apply: (img) => compressContrast(img, 70, 190),
  },
  {
    id: "stress",
    label: "Combined: blur + 9° rotation + falloff + noise",
    required: false,
    apply: (img, { ppm, rand }) =>
      addNoise(unevenLight(rotate(gaussianBlur(img, 0.22 * ppm), 9, SURROUND), 0.65, 2.2), 8, rand),
  },
];

export type DecoderOutcome = { ok: boolean; text: string | null };

export type ConditionResult = {
  id: string;
  label: string;
  required: boolean;
  decoders: Record<string, DecoderOutcome>;
};

export type ValidationReport = {
  payload: string;
  /** every required condition decoded to the exact payload on every decoder */
  pass: boolean;
  /** share of (condition, decoder) reads that returned the exact payload */
  robustness: number;
  decoders: string[];
  results: ConditionResult[];
  /** "condition/decoder: reason" for every failed read */
  failures: string[];
  /** set when validation stopped after a required failure */
  truncated: boolean;
};

export type ValidateOptions = {
  ppm: number;
  conditions?: readonly ScanCondition[];
  decoders?: readonly QrDecoder[];
  seed?: number;
  /** stop at the first required failure (fast rejection) */
  failFast?: boolean;
};

export function validateRaster(raster: Raster, payload: string, opts: ValidateOptions): ValidationReport {
  const conditions = opts.conditions ?? DEFAULT_CONDITIONS;
  const decoders = opts.decoders ?? DEFAULT_DECODERS;
  const base = toGray(raster);
  const results: ConditionResult[] = [];
  const failures: string[] = [];
  let reads = 0;
  let exact = 0;
  let pass = true;
  let truncated = false;
  for (let c = 0; c < conditions.length; c++) {
    const cond = conditions[c];
    const img = cond.apply(base, { ppm: opts.ppm, rand: rng((opts.seed ?? 1) * 7919 + c) });
    const outcome: Record<string, DecoderOutcome> = {};
    for (const decoder of decoders) {
      const text = decoder.decode(img);
      const ok = text === payload;
      outcome[decoder.name] = { ok, text };
      reads++;
      if (ok) exact++;
      else {
        failures.push(`${cond.id}/${decoder.name}: ${text === null ? "no decode" : "payload mismatch"}`);
        if (cond.required) pass = false;
      }
    }
    results.push({ id: cond.id, label: cond.label, required: cond.required, decoders: outcome });
    if (!pass && opts.failFast) {
      truncated = c < conditions.length - 1;
      break;
    }
  }
  const total = conditions.length * decoders.length;
  return {
    payload,
    pass,
    robustness: truncated ? exact / total : reads > 0 ? exact / reads : 0,
    decoders: decoders.map((d) => d.name),
    results,
    failures,
    truncated,
  };
}
