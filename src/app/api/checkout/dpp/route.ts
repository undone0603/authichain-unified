/**
 * Attributed Checkout Session for the EU DPP Readiness Audit ($299).
 *
 * GET /api/checkout/dpp?... → 303 to Stripe Checkout
 *
 * Captures visit/UTM context into session.metadata + client_reference_id so the
 * canonical Stripe webhook can provision and reconstruct the revenue loop.
 */

import { NextRequest, NextResponse } from "next/server";
import { DPP_OFFER_KEY, PLANS } from "@/lib/plans";
import { recordDppLoopEvent } from "@/lib/dpp-loop";
import { logAutomation } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN = PLANS.find(p => p.id === "dpp_readiness")!;
const APP_ORIGIN = "https://authichain.com";

function pick(params: URLSearchParams, key: string, max = 128): string {
  return (params.get(key) || "").trim().slice(0, max);
}

function newVisitId(): string {
  return `dpp_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

async function getServiceSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }
    if (!PLAN?.stripe_price_id || PLAN.stripe_mode !== "payment") {
      return NextResponse.json(
        { error: "DPP offer is not configured" },
        { status: 500 }
      );
    }

    const params = request.nextUrl.searchParams;
    const visitId =
      pick(params, "visit_id") || pick(params, "prospect_id") || newVisitId();
    const email = pick(params, "email", 254);
    const utmSource = pick(params, "utm_source", 64);
    const utmMedium = pick(params, "utm_medium", 64);
    const utmCampaign = pick(params, "utm_campaign", 128);
    const utmContent = pick(params, "utm_content", 128);
    const utmTerm = pick(params, "utm_term", 128);
    const referrer = pick(params, "referrer", 512);
    const source = utmSource || pick(params, "source", 64) || "direct";

    const supabase = await getServiceSupabase();
    if (supabase) {
      await recordDppLoopEvent(supabase, {
        visitId,
        stage: "checkout_started",
        source,
        metadata: {
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          utm_campaign: utmCampaign || null,
          utm_content: utmContent || null,
          utm_term: utmTerm || null,
          referrer: referrer || null,
        },
      });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-08-26.dahlia" as const,
    });

    // Stripe replaces the literal {CHECKOUT_SESSION_ID} token in success_url.
    const successUrl = `${APP_ORIGIN}/dpp/thanks?session_id={CHECKOUT_SESSION_ID}&visit_id=${encodeURIComponent(visitId)}`;
    const cancelUrl = `${APP_ORIGIN}/dpp?cancelled=1&visit_id=${encodeURIComponent(visitId)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: PLAN.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      client_reference_id: visitId.slice(0, 200),
      ...(email ? { customer_email: email } : {}),
      metadata: {
        plan: PLAN.id,
        brand: "authichain",
        offer: DPP_OFFER_KEY,
        prospect_id: visitId,
        visit_id: visitId,
        source,
        ...(utmSource ? { utm_source: utmSource } : {}),
        ...(utmMedium ? { utm_medium: utmMedium } : {}),
        ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
        ...(utmContent ? { utm_content: utmContent } : {}),
        ...(utmTerm ? { utm_term: utmTerm } : {}),
        ...(referrer ? { referrer } : {}),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session missing URL" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    console.error("[checkout/dpp] Error:", error);
    await logAutomation(
      "dpp_checkout_session_create",
      "event",
      "failure",
      null,
      `${err?.type || "Error"}: ${err?.message || "unknown"}`
    );
    return NextResponse.json(
      { error: "Failed to start DPP checkout", detail: err?.message },
      { status: 500 }
    );
  }
}
