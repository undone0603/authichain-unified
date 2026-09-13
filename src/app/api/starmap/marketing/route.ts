import { NextResponse } from "next/server";
import { z } from "zod";
import { buildNightstampMarketing } from "@/lib/starmap/marketing";
import { makePayload } from "@/lib/starmap/render";
import type { NightstampInput } from "@/lib/starmap/types";

const inputSchema = z.object({
  id: z.string().min(4).max(64),
  eventAt: z.string().datetime(),
  placeLabel: z.string().max(120),
  dedication: z.string().max(240).optional(),
  dateISO: z.string(),
  time: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  tz: z.string().min(1),
  style: z.enum(["navy-gold", "parchment", "glow"]),
  sku: z.enum(["preview", "digital", "portal", "certified"]),
  ref: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.parse(await request.json());
    const input: NightstampInput = {
      dateISO: parsed.dateISO,
      time: parsed.time,
      lat: parsed.lat,
      lon: parsed.lon,
      tz: parsed.tz,
      placeLabel: parsed.placeLabel,
      dedication: parsed.dedication,
      style: parsed.style,
      sku: parsed.sku,
    };
    const payload = await makePayload(parsed.id, parsed.eventAt);
    return NextResponse.json(buildNightstampMarketing(input, payload, parsed.ref));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
