import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { renderNightstamp, localCivilToDate, makePayload } from "@/lib/starmap/render";

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
    if (input.sku !== "preview") {
      return NextResponse.json(
        {
          error: "Payment required before generating a paid Nightstamp",
          code: "PAYMENT_REQUIRED",
          checkout_endpoint: "/api/starmap/checkout",
        },
        { status: 402 }
      );
    }

    const eventDate = localCivilToDate(input);
    const id = nanoid(14);
    const payload = await makePayload(id, eventDate.toISOString());
    const png = await renderNightstamp(input, payload, true);

    return NextResponse.json({
      payload,
      png: `data:image/png;base64,${png.toString("base64")}`,
      preview: true,
    });
  } catch (error) {
    console.error("[Nightstamp] generation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "GENERATION_FAILED" }, { status: 400 });
  }
}
