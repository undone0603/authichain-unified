import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { nanoid } from "nanoid";
import { localCivilToDate } from "@/lib/starmap/render";

export const runtime = "nodejs";

const schema = z.object({
  dateISO: z.string(), time: z.string().default("22:00"), lat: z.number(), lon: z.number(), tz: z.string(), placeLabel: z.string().max(160), dedication: z.string().max(500).optional(), sku: z.enum(["digital", "portal", "certified"]),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" as const });
    const price = input.sku === "digital" ? process.env.NIGHTSTAMP_PRICE_9 : input.sku === "portal" ? process.env.NIGHTSTAMP_PRICE_29 : process.env.NIGHTSTAMP_PRICE_49;
    if (!price) return NextResponse.json({ error: `Missing NIGHTSTAMP_PRICE for ${input.sku}` }, { status: 500 });
    const skyId = nanoid(14);
    const eventAt = localCivilToDate(input).toISOString();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: `https://qron.space/api/starmap/fulfill?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: "https://qron.space/starmap",
      metadata: { product: "nightstamp", sky_id: skyId, event_at: eventAt, lat: String(input.lat), lon: String(input.lon), place_label: input.placeLabel, tz: input.tz, dedication: input.dedication ?? "", tenant: "qron", sku: input.sku },
    });
    return NextResponse.json({ url: session.url, skyId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "CHECKOUT_FAILED" }, { status: 400 });
  }
}
