/**
 * Attributed Checkout Session for catalogue plans with a live Stripe price.
 *
 * GET /api/checkout/plan/:planId → 303 to Stripe Checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { createPlanCheckoutSession } from "@/lib/plan-checkout";
import { logAutomation } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ planId: string }> };

export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { planId } = await context.params;
  try {
    const search = request.nextUrl.searchParams;
    const result = await createPlanCheckoutSession({
      request,
      body: {
        planId,
        email: search.get("email") ?? undefined,
        prospectId:
          search.get("prospect_id") ?? search.get("visit_id") ?? undefined,
        source: search.get("utm_source") ?? search.get("source") ?? undefined,
        affiliateCode: search.get("affiliate_code") ?? undefined,
      },
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.detail ? { detail: result.detail } : {}),
        },
        { status: result.status }
      );
    }
    return NextResponse.redirect(result.url, 303);
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    console.error("[checkout/plan] Error:", error);
    await logAutomation(
      "plan_checkout_session_create",
      "event",
      "failure",
      planId,
      `${err?.type || "Error"}: ${err?.message || "unknown"}`
    );
    return NextResponse.json(
      { error: "Failed to start checkout", detail: err?.message },
      { status: 500 }
    );
  }
}
