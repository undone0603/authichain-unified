import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { renderNightstamp, localCivilToDate, makePayload } from "@/lib/starmap/render";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateQRScannability } from "@/lib/vision";

export const runtime = "nodejs";

const inputSchema = z.object({
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  tz: z.string().min(1),
  placeLabel: z.string().min(1).max(160),
  dedication: z.string().max(500).optional(),
  style: z.enum(["navy-gold", "parchment", "glow"]).default("navy-gold"),
  sku: z.enum(["preview", "digital", "portal", "certified"]).default("preview"),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const eventDate = localCivilToDate(input);
    const id = nanoid(14);
    const payload = makePayload(id, eventDate.toISOString());
    const preview = input.sku === "preview";
    const png = await renderNightstamp(input, payload, preview);

    if (!preview) {
      const scan = await validateQRScannability(png);
      if (!scan.isScannable || scan.content !== payload.url) {
        return NextResponse.json({ error: "SCAN_GATE_FAILED", detail: scan.error ?? "payload mismatch" }, { status: 422 });
      }
      const { error } = await supabaseAdmin.from("qr_arts").insert({
        id,
        preset: "starmap",
        event_at: eventDate.toISOString(),
        lat: input.lat,
        lon: input.lon,
        tz: input.tz,
        place_label: input.placeLabel,
        catalog_hash: payload.catalogHash,
        sku: input.sku,
        qr_data: payload.url,
        dedication: input.dedication ?? null,
        style: input.style,
        tenant: "qron",
      });
      if (error) throw error;
    }

    return NextResponse.json({
      skyId: preview ? undefined : id,
      payload,
      png: `data:image/png;base64,${png.toString("base64")}`,
      preview,
    });
  } catch (error) {
    console.error("[Nightstamp] generation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "GENERATION_FAILED" }, { status: 400 });
  }
}
