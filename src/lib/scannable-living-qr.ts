/**
 * Spec-valid Living QR rasters for POST /api/generate.
 *
 * Image models hallucinate QR grids and URL lettering. This module starts
 * from an ISO/IEC 18004 symbol (ECC H, else M), keeps finder / alignment /
 * timing / format modules high-contrast, and optionally blends artwork into
 * data modules. The PNG that /generate displays is this raster, never the
 * raw model output.
 */
import { inflateSync } from "node:zlib";
import {
  encodeSymbol,
  minimumVersion,
  penaltyScore,
  type Ecl,
  type QrSymbol,
} from "./qron-studio/encoder";
import { encodePng } from "./qron-studio/png";
import {
  PALETTES,
  renderRaster,
  type DesignStyle,
  type Palette,
  type Raster,
} from "./qron-studio/render";
import { imageTarget, motif, type TargetField } from "./qron-studio/targets";

export const LIVING_QR_SCAN_DISCLAIMER =
  "A scannable QR is not an authenticity proof.";

const ART_PROMPT_SUFFIX =
  "Decorative abstract background artwork only. No text, no letters, no numbers, no QR code, no barcode, no URL.";

const URL_TOKEN = /https?:\/\/\S+/gi;

const STYLE_PALETTE: Record<string, Palette> = {
  gold_vault: PALETTES[0],
  luxury_dark: PALETTES[6],
  neon_cyber: PALETTES[1],
  marble_white: PALETTES[6],
};

const STYLE_MOTIF: Record<string, string> = {
  gold_vault: "sunrise",
  luxury_dark: "rings",
  neon_cyber: "spiral",
  marble_white: "waves",
};

export type ScannableLivingQr = {
  imageUrl: string;
  payload: string;
  ecl: Ecl;
  blendedArtwork: boolean;
  disclaimer: typeof LIVING_QR_SCAN_DISCLAIMER;
};

/** Strip destination URLs so the image model cannot paint garbled link text. */
export function artPromptForQronImageGen(prompt: string): string {
  const cleaned = String(prompt || "")
    .replace(URL_TOKEN, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned || "Premium geometric composition";
  return `${base}. ${ART_PROMPT_SUFFIX}`;
}

export function rasterToPngDataUrl(raster: Raster): string {
  const png = encodePng(raster);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function bytesFromDataUrl(
  dataUrl: string
): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mime = (match[1] || "application/octet-stream").toLowerCase();
  const payload = match[3] || "";
  try {
    const binary = match[2] ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mime, bytes };
  } catch {
    return null;
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterRow(
  filter: number,
  row: Uint8Array,
  prev: Uint8Array | null,
  bpp: number
): Uint8Array | null {
  const out = new Uint8Array(row.length);
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? out[i - bpp] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
    const x = row[i];
    if (filter === 0) out[i] = x;
    else if (filter === 1) out[i] = (x + left) & 255;
    else if (filter === 2) out[i] = (x + up) & 255;
    else if (filter === 3) out[i] = (x + ((left + up) >> 1)) & 255;
    else if (filter === 4) out[i] = (x + paeth(left, up, upLeft)) & 255;
    else return null;
  }
  return out;
}

/** Decode an 8-bit non-interlaced RGB/RGBA PNG into an RGBA raster. */
export function decodePngBytes(bytes: Uint8Array): Raster | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || sig.some((b, i) => bytes[i] !== b)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const len =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    if (len < 0 || offset + 12 + len > bytes.length) return null;
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const data = bytes.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      if (data.length < 13) return null;
      width = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
      height = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
      bitDepth = data[8];
      colorType = data[9];
      if (data[10] !== 0 || data[12] !== 0) return null;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  if (
    !width ||
    !height ||
    bitDepth !== 8 ||
    (colorType !== 2 && colorType !== 6)
  ) {
    return null;
  }
  const bpp = colorType === 6 ? 4 : 3;
  let inflated: Uint8Array;
  try {
    const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const chunk of idat) {
      joined.set(chunk, at);
      at += chunk.length;
    }
    inflated = inflateSync(joined);
  } catch {
    return null;
  }
  const stride = width * bpp;
  const expected = (stride + 1) * height;
  if (inflated.length < expected) return null;
  const rgba = new Uint8ClampedArray(width * height * 4);
  let prev: Uint8Array | null = null;
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = inflated[rowStart];
    const raw = inflated.subarray(rowStart + 1, rowStart + 1 + stride);
    const recon = unfilterRow(filter, raw, prev, bpp);
    if (!recon) return null;
    prev = recon;
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 4;
      rgba[d] = recon[s];
      rgba[d + 1] = recon[s + 1];
      rgba[d + 2] = recon[s + 2];
      rgba[d + 3] = bpp === 4 ? recon[s + 3] : 255;
    }
  }
  return { width, height, data: rgba };
}

export function decodePngDataUrl(dataUrl: string): Raster | null {
  const parsed = bytesFromDataUrl(dataUrl);
  if (!parsed) return null;
  if (parsed.mime !== "image/png" && parsed.bytes[0] !== 0x89) return null;
  return decodePngBytes(parsed.bytes);
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function encodePayload(payload: string): { symbol: QrSymbol; ecl: Ecl } {
  for (const ecl of ["H", "M"] as const) {
    try {
      const version = minimumVersion(payload, ecl);
      let best: QrSymbol | null = null;
      let bestScore = Infinity;
      for (let mask = 0; mask < 8; mask++) {
        const symbol = encodeSymbol({ payload, ecl, mask, version });
        const score = penaltyScore(symbol.modules, symbol.size);
        if (score < bestScore) {
          best = symbol;
          bestScore = score;
        }
      }
      if (best) return { symbol: best, ecl };
    } catch {
      continue;
    }
  }
  throw new Error("qr_encode_failed");
}

function styleFor(style: string | undefined): {
  palette: Palette;
  motifId: string;
} {
  const key = typeof style === "string" ? style.trim() : "";
  return {
    palette: STYLE_PALETTE[key] ?? PALETTES[0],
    motifId: STYLE_MOTIF[key] ?? "rings",
  };
}

function artworkField(artworkDataUrl?: string | null): TargetField | null {
  if (!artworkDataUrl) return null;
  const raster = decodePngDataUrl(artworkDataUrl);
  if (!raster || raster.width < 8 || raster.height < 8) return null;
  return imageTarget(raster.data, raster.width, raster.height, "artwork");
}

function designStyle(palette: Palette, field: TargetField | null): DesignStyle {
  if (field) {
    return {
      shape: "halftone",
      finder: "square",
      palette,
      gradient: false,
      scale: 0.78,
      blend: 0.7,
    };
  }
  return {
    shape: "square",
    finder: "square",
    palette,
    gradient: false,
    scale: 1,
  };
}

/**
 * Build a PNG that standard QR readers decode to `payload`.
 * Artwork is used when it is a decodable PNG; otherwise a style motif fills in.
 */
export function composeScannableLivingQr(opts: {
  payload: string;
  artworkDataUrl?: string | null;
  style?: string;
}): ScannableLivingQr {
  const payload = String(opts.payload || "");
  if (!payload) throw new Error("qr_payload_required");
  const { symbol, ecl } = encodePayload(payload);
  const { palette, motifId } = styleFor(opts.style);
  const artwork = artworkField(opts.artworkDataUrl);
  const field =
    artwork ?? motif(motifId, hashSeed(`${payload}|${opts.style || ""}`));
  const raster = renderRaster(symbol, designStyle(palette, artwork), {
    // Studio's scanner-in-the-loop gate uses 4 px/module. JS ZXing 0.21.3
    // checksum-fails some valid higher-ppm rasters that jsQR still reads.
    ppm: 4,
    quiet: 4,
    supersample: 1,
    field,
  });
  return {
    imageUrl: rasterToPngDataUrl(raster),
    payload,
    ecl,
    blendedArtwork: Boolean(artwork),
    disclaimer: LIVING_QR_SCAN_DISCLAIMER,
  };
}
