import { NextResponse } from "next/server";
import Stripe from "stripe";
import { renderNightstamp, makePayload } from "@/lib/starmap/render";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateQRScannability } from "@/lib/vision";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  try {
    const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" as const });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const md = session.metadata ?? {};
    if (md.product !== "nightstamp" || session.payment_status !== "paid") return NextResponse.json({ error: "Payment not complete or not a Nightstamp checkout" }, { status: 409 });

    const id = md.sky_id;
    const eventAt = md.event_at;
    const lat = Number(md.lat);
    const lon = Number(md.lon);
    const tz = md.tz || "UTC";
    const placeLabel = md.place_label || "Nightstamp";
    if (!id || !eventAt || !Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: "Incomplete Nightstamp metadata" }, { status: 422 });

    const existing = await supabaseAdmin.from("qr_arts").select("id").eq("id", id).maybeSingle();
    if (!existing.data) {
      const d = new Date(eventAt);
      const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
      const get = (t: string) => local.find(p => p.type === t)?.value ?? "00";
      const dateISO = `${get("year")}-${get("month")}-${get("day")}`;
      const time = `${get("hour")}:${get("minute")}`;
      const payload = await makePayload(id, d.toISOString());
      const png = await renderNightstamp({ dateISO, time, lat, lon, tz, placeLabel, dedication: md.dedication || undefined, style: "navy-gold", sku: md.sku === "certified" ? "certified" : md.sku === "portal" ? "portal" : "digital" }, payload);
      const scan = await validateQRScannability(png);
      if (!scan.isScannable || scan.content !== payload.url) return NextResponse.json({ error: "SCAN_GATE_FAILED" }, { status: 422 });
      const { error } = await supabaseAdmin.from("qr_arts").insert({ id, preset: "starmap", event_at: d.toISOString(), lat, lon, tz, place_label: placeLabel, catalog_hash: payload.catalogHash, sku: md.sku || "digital", qr_data: payload.url, dedication: md.dedication || null, style: "navy-gold", tenant: "qron", stripe_session_id: session.id, customer_email: session.customer_email || session.customer_details?.email || null });
      if (error) throw error;
      const email = session.customer_email || session.customer_details?.email;
      if (email) await sendEmail({ to: email, subject: "Your Nightstamp is ready", html: `<p>Your night is ready.</p><p><a href="${payload.url}">Open your Memory Portal</a></p>`, text: `Your Nightstamp is ready: ${payload.url}` }).catch(() => {});
    }
    return NextResponse.redirect(`https://qron.space/sky/${id}`);
  } catch (error) {
    console.error("[Nightstamp] fulfillment failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "FULFILLMENT_FAILED" }, { status: 500 });
  }
}
