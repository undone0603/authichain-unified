/**
 * Self-serve merchant activation for the EU DPP Readiness Audit.
 * Completing intake records merchant_activated — no human handoff required.
 */

import { NextRequest, NextResponse } from "next/server";
import { dppActivateUrl, isDppOffer, recordDppLoopEvent } from "@/lib/dpp-loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ActivateBody {
  session_id?: string;
  visit_id?: string;
  categories?: string;
  markets?: string;
  labeling?: string;
  call_windows?: string;
}

async function getServiceSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    let body: ActivateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const sessionId = (body.session_id || "").trim();
    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    const categories = (body.categories || "").trim();
    const markets = (body.markets || "").trim();
    const labeling = (body.labeling || "").trim();
    if (!categories || !markets || !labeling) {
      return NextResponse.json(
        { error: "categories, markets, and labeling are required" },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-08-26.dahlia" as const,
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json(
        { error: "Checkout session is not paid" },
        { status: 402 }
      );
    }

    const md = (session.metadata || {}) as Record<string, unknown>;
    if (
      !isDppOffer(md) &&
      session.amount_total !== 29900 &&
      session.amount_total !== 0
    ) {
      // Allow smoke promo ($0) and exact audit amount; reject unrelated sessions.
      return NextResponse.json(
        { error: "Not a DPP audit session" },
        { status: 400 }
      );
    }

    const email = (
      session.customer_details?.email ||
      session.customer_email ||
      ""
    )
      .toLowerCase()
      .trim();
    const visitId =
      (body.visit_id || "").trim() ||
      String(
        md.visit_id ||
          md.prospect_id ||
          session.client_reference_id ||
          sessionId
      );

    const supabase = await getServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    let profileId: string | null = null;
    if (email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      profileId = (profile?.id as string) || null;
    }

    // Soft idempotency: if this visit already recorded merchant_activated, skip insert.
    const { data: prior } = await supabase
      .from("funnel_events")
      .select("id, metadata")
      .eq("prospect_id", visitId)
      .eq("event_type", "dpp_loop:merchant_activated")
      .order("timestamp", { ascending: false })
      .limit(5);

    const alreadyActivated = Array.isArray(prior)
      ? prior.some(
          (row: { metadata?: { stripe_session_id?: string } }) =>
            row?.metadata?.stripe_session_id === sessionId
        )
      : false;

    if (!alreadyActivated) {
      await recordDppLoopEvent(supabase, {
        visitId,
        stage: "merchant_activated",
        source: String(md.source || "direct"),
        email,
        profileId,
        stripeSessionId: sessionId,
        metadata: {
          categories,
          markets,
          labeling,
          call_windows: (body.call_windows || "").trim() || null,
          activated_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      profile_id: profileId,
      visit_id: visitId,
      already_activated: alreadyActivated,
      next: "/dashboard",
      activate_url: dppActivateUrl(sessionId, visitId),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[dpp/activate] Error:", error);
    return NextResponse.json(
      { error: "Activation failed", detail: err?.message },
      { status: 500 }
    );
  }
}
