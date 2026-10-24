import { supabaseAdmin as supabase } from "../../../lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { resolveCommerce } from "../../../lib/economic-authority";
import { gatedCheckoutUrl, listedPlans, planById } from "../../../lib/plans";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
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

    const body = (await req.json()) as { plan?: string };
    const plan = typeof body.plan === "string" ? body.plan.trim() : "";
    const commerce = resolveCommerce(plan);
    const row = commerce.plan_id ? planById(commerce.plan_id) : undefined;
    if (
      !commerce.publicly_sellable ||
      !row?.stripe_price_id ||
      !row.stripe_mode
    ) {
      return NextResponse.json(
        { error: "Plan is not a public offer" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: row.id,
      checkout_url: gatedCheckoutUrl(row.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
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
