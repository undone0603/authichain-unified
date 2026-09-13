import QRCode from "qrcode";
import { BRIGHT_STARS, CONSTELLATIONS } from "./catalog";
import type { NightstampInput, NightstampPayload } from "./types";

const TAU = Math.PI * 2;
const deg = (v: number) => (v * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Palette = { bg: number; qr: number; star: number; starBright: number };

const PALETTES: Record<NightstampInput["style"], Palette> = {
  "navy-gold": { bg: 0x0b1220ff, qr: 0xf8f5ecff, star: 0x9f8a58ff, starBright: 0xf5d98aff },
  parchment: { bg: 0xf3ead7ff, qr: 0x211d18ff, star: 0x8a6b3fff, starBright: 0x4b3924ff },
  glow: { bg: 0x05070bff, qr: 0xf5f7ffff, star: 0x8cb7ffff, starBright: 0xdceaffff },
};

function tzOffsetMinutes(localISO: string, tz: string): number {
  const guess = new Date(`${localISO}Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(guess);
  const value = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT+0";
  const m = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export function localCivilToDate(input: Pick<NightstampInput, "dateISO" | "time" | "tz">): Date {
  const local = `${input.dateISO}T${input.time || "22:00"}:00`;
  const guess = new Date(`${local}Z`);
  return new Date(guess.getTime() - tzOffsetMinutes(local, input.tz) * 60_000);
}

function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function gmstDegrees(jd: number): number {
  const t = (jd - 2451545.0) / 36525;
  return ((280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000) % 360 + 360) % 360;
}

function project(ra: number, dec: number, lat: number, lon: number, jd: number) {
  const lst = (gmstDegrees(jd) + lon + 360) % 360;
  const ha = deg((((lst - ra) + 540) % 360) - 180);
  const phi = deg(lat);
  const delta = deg(dec);
  const altitude = Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(ha));
  const azimuth = Math.atan2(-Math.sin(ha), Math.tan(delta) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { altitude, azimuth: (azimuth + TAU) % TAU };
}

export async function catalogHash(): Promise<string> {
  const source = JSON.stringify({ stars: BRIGHT_STARS, constellations: CONSTELLATIONS });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function makePayload(id: string, eventAt: string): Promise<NightstampPayload> {
  return { id, url: `https://qron.space/sky/${id}`, eventAt, catalogHash: await catalogHash() };
}

function setPixel(bitmap: any, x: number, y: number, rgba: number) {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return;
  const idx = (y * bitmap.width + x) * 4;
  bitmap.data[idx] = (rgba >>> 24) & 255;
  bitmap.data[idx + 1] = (rgba >>> 16) & 255;
  bitmap.data[idx + 2] = (rgba >>> 8) & 255;
  bitmap.data[idx + 3] = rgba & 255;
}

export async function renderNightstamp(input: NightstampInput, payload: NightstampPayload, watermark = false): Promise<Buffer> {
  const target = payload.url;
  const qr = QRCode.create(target, { errorCorrectionLevel: "H", maskPattern: 0 });
  const moduleCount = qr.modules.size;
  const quiet = 4;
  const width = watermark ? 800 : 2400;
  const modulePx = Math.max(4, Math.floor(width / (moduleCount + quiet * 2)));
  const qrPx = (moduleCount + quiet * 2) * modulePx;
  const base = await QRCode.toBuffer(target, {
    errorCorrectionLevel: "H",
    width: qrPx,
    margin: quiet,
    color: { dark: "#211d18", light: "#f8f5ec" },
  });

  const mod = await import("jimp") as any;
  const J = mod.Jimp ?? mod.default;
  const qrImage = await J.read(base);
  const canvasSize = Math.max(qrPx + modulePx * 16, width);
  const palette = PALETTES[input.style];
  const image = new J({ width: canvasSize, height: canvasSize, color: palette.bg });
  image.composite(qrImage, Math.floor((canvasSize - qrPx) / 2), Math.floor((canvasSize - qrPx) / 2));

  const bitmap = image.bitmap;
  const center = bitmap.width / 2;
  const jd = julianDate(localCivilToDate(input));
  const qrLeft = (canvasSize - qrPx) / 2;
  const qrRight = qrLeft + qrPx;
  const qrTop = qrLeft;
  const qrBottom = qrTop + qrPx;

  // The QR itself is never modified. Stars and constellation lines live in the
  // surrounding deterministic field, so scan safety does not depend on an AI model.
  for (const star of BRIGHT_STARS) {
    if (star.mag > 4.5) continue;
    const p = project(star.ra, star.dec, input.lat, input.lon, jd);
    if (p.altitude <= 0) continue;
    const radial = (Math.PI / 2 - p.altitude) / (Math.PI / 2);
    const r = radial * bitmap.width * 0.47;
    const x = center + Math.sin(p.azimuth) * r;
    const y = center - Math.cos(p.azimuth) * r;
    const radius = star.mag <= 1 ? 5 : star.mag <= 3 ? 3 : 2;
    if (x > qrLeft - radius && x < qrRight + radius && y > qrTop - radius && y < qrBottom + radius) continue;
    const color = star.mag <= 2 ? palette.starBright : palette.star;
    for (let yy = -radius; yy <= radius; yy++) for (let xx = -radius; xx <= radius; xx++) {
      if (xx * xx + yy * yy <= radius * radius) setPixel(bitmap, Math.round(x + xx), Math.round(y + yy), color);
    }
  }

  return image.getBuffer("image/png");
}
