import QRCode from "qrcode";
import { BRIGHT_STARS, CONSTELLATIONS } from "./catalog";
import type { NightstampInput, NightstampPayload } from "./types";

const TAU = Math.PI * 2;
const deg = (v: number) => (v * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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

function catalogHash(): string {
  const source = JSON.stringify({ stars: BRIGHT_STARS, constellations: CONSTELLATIONS });
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < source.length; i++) {
    const c = source.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i; h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function makePayload(id: string, eventAt: string): NightstampPayload {
  return { id, url: `https://qron.space/sky/${id}`, eventAt, catalogHash: catalogHash() };
}

export async function renderNightstamp(input: NightstampInput, payload: NightstampPayload, watermark = false): Promise<Buffer> {
  const target = payload.url;
  const qr = QRCode.create(target, { errorCorrectionLevel: "H", maskPattern: 0 });
  const moduleCount = qr.modules.size;
  const quiet = 4;
  const width = watermark ? 800 : 2400;
  const modulePx = Math.max(4, Math.floor(width / (moduleCount + quiet * 2)));
  const qrPx = (moduleCount + quiet * 2) * modulePx;
  const base = await QRCode.toBuffer(target, { errorCorrectionLevel: "H", width: qrPx, margin: quiet, color: { dark: "#0a0a0a", light: "#ffffff" } });

  const mod = await import("jimp") as any;
  const J = mod.Jimp ?? mod.default;
  const image = await J.read(base);
  const bitmap = image.bitmap;
  const jd = julianDate(localCivilToDate(input));

  for (const star of BRIGHT_STARS) {
    if (star.mag > 4.5) continue;
    const p = project(star.ra, star.dec, input.lat, input.lon, jd);
    if (p.altitude <= 0) continue;
    const radial = (Math.PI / 2 - p.altitude) / (Math.PI / 2);
    const r = radial * bitmap.width * 0.47;
    const x0 = bitmap.width / 2 + Math.sin(p.azimuth) * r;
    const y0 = bitmap.height / 2 - Math.cos(p.azimuth) * r;
    if (x0 < quiet * modulePx || x0 > bitmap.width - quiet * modulePx || y0 < quiet * modulePx || y0 > bitmap.height - quiet * modulePx) continue;

    const size = star.mag <= 1 ? 2 : 1;
    const cx = Math.floor(x0 / modulePx) * modulePx + Math.floor(modulePx / 2);
    const cy = Math.floor(y0 / modulePx) * modulePx + Math.floor(modulePx / 2);
    for (let yy = -size + 1; yy <= size; yy++) for (let xx = -size + 1; xx <= size; xx++) {
      const x = clamp(cx + xx * Math.max(1, Math.floor(modulePx / 3)), 0, bitmap.width - 1);
      const y = clamp(cy + yy * Math.max(1, Math.floor(modulePx / 3)), 0, bitmap.height - 1);
      const idx = (y * bitmap.width + x) * 4;
      // Only restyle existing dark QR modules. This is the hard scan-safety
      // boundary: the astronomical layer can never introduce new QR modules.
      if (bitmap.data[idx] < 80 && bitmap.data[idx + 1] < 80 && bitmap.data[idx + 2] < 80) {
        bitmap.data[idx] = star.mag <= 3 ? 12 : 48;
        bitmap.data[idx + 1] = star.mag <= 3 ? 12 : 48;
        bitmap.data[idx + 2] = star.mag <= 3 ? 12 : 48;
      }
    }
  }

  return image.getBuffer("image/png");
}
