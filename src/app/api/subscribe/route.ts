import type Stripe from "stripe";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { gatedCheckoutUrl, listedPlans } from "@/lib/plans";

export const runtime = "nodejs";

// QRON Stripe Price IDs — set in env or map here
const PLAN_PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
  business: process.env.STRIPE_PRICE_BUSINESS || "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey)
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );

    const StripeClient = (await import("stripe")).default;
    const stripe = new StripeClient(stripeKey, {
      apiVersion: "2026-08-26.dahlia" as const,
    });

    const authHeader = req.headers.get("authorization");
    if (!authHeader)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !user)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = (await req.json()) as {
      plan?: string;
      success_url?: string;
      cancel_url?: string;
      trial_days?: string | number;
    };
    const { plan, success_url, cancel_url, trial_days } = body;

    if (!plan || !PLAN_PRICE_MAP[plan]) {
      return NextResponse.json(
        {
          error: `Invalid plan. Available: ${Object.keys(PLAN_PRICE_MAP).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const priceId = PLAN_PRICE_MAP[plan];
    if (!priceId)
      return NextResponse.json(
        { error: `Price not configured for plan: ${plan}` },
        { status: 500 }
      );

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", user.id)
      .single();

    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: profile?.full_name || undefined,
        metadata: { supabase_user_id: user.id, platform: "qron" },
      });
      stripeCustomerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customer.id })
        .eq("id", user.id);
    }

    // Build checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        success_url ||
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscribed=true&plan=${plan}`,
      cancel_url:
        cancel_url ||
        `${process.env.NEXT_PUBLIC_APP_URL}/pricing?cancelled=true`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: { user_id: user.id, plan, platform: "qron" },
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
    };

    // Add trial if requested
    const trialDays = trial_days
      ? Number.parseInt(String(trial_days), 10)
      : Number.NaN;
    if (!Number.isNaN(trialDays) && trialDays > 0) {
      sessionParams.subscription_data = {
        ...sessionParams.subscription_data,
        trial_period_days: trialDays,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Log the checkout attempt
    await supabase
      .from("checkout_sessions")
      .insert({
        user_id: user.id,
        session_id: session.id,
        plan,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select();

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      plan,
    });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function GET(_unused_req_131: NextRequest) {
  // Public plans come from the catalogue so hidden SKUs (Theater, Studio,
  // Business) never reappear here. Checkout goes through the gated confirm page.
  const plans = listedPlans().map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    price_suffix: p.price_suffix ?? null,
    mode: p.stripe_mode,
    features: p.features,
    checkout_url: p.price === 0 ? null : gatedCheckoutUrl(p.id),
  }));
  return NextResponse.json({ success: true, plans, currency: "usd" });
}
