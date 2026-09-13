import { renderNightstamp, makePayload } from "../src/lib/starmap/render";
import { validateQRScannability } from "../src/lib/vision";
import type { NightstampInput } from "../src/lib/starmap/types";

const fixtures: NightstampInput[] = [
  ...Array.from({ length: 16 }, (_, i) => ({
    dateISO: `202${i % 6}-0${(i % 8) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
    time: `${String(18 + (i % 6)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
    lat: -80 + i * 10,
    lon: -170 + i * 20,
    tz: "UTC",
    placeLabel: `Fixture ${i + 1}`,
    style: "navy-gold" as const,
    sku: "preview" as const,
  })),
  { dateISO: "2024-02-29", time: "22:00", lat: 0, lon: 0, tz: "UTC", placeLabel: "Equator leap day", style: "navy-gold", sku: "preview" },
  { dateISO: "2024-03-10", time: "02:30", lat: 42.96, lon: -85.67, tz: "America/Detroit", placeLabel: "DST spring", style: "navy-gold", sku: "preview" },
  { dateISO: "2024-11-03", time: "01:30", lat: 42.96, lon: -85.67, tz: "America/Detroit", placeLabel: "DST fall", style: "navy-gold", sku: "preview" },
  { dateISO: "2025-06-21", time: "23:59", lat: 89.0, lon: 0, tz: "UTC", placeLabel: "Polar", style: "navy-gold", sku: "preview" },
];

for (let i = 0; i < fixtures.length; i++) {
  const input = fixtures[i];
  const payload = await makePayload(`gate-${i + 1}`, `${input.dateISO}T${input.time}:00.000Z`);
  const png = await renderNightstamp(input, payload, true);
  const result = await validateQRScannability(png);
  if (!result.isScannable || result.content !== payload.url) throw new Error(`Nightstamp scan gate failed fixture ${i + 1}: ${result.error ?? result.content ?? "no decode"}`);
}

console.log(`Nightstamp scan gate passed: ${fixtures.length} fixtures`);
