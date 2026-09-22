/**
 * Attributed Checkout Session for catalogue plans with a live Stripe price.
 *
 * GET /api/checkout/plan/:planId → 303 to Stripe Checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { CHECKOUT_REDIRECT_HEADERS } from "@/lib/checkout-email";
import { createPlanCheckoutSession } from "@/lib/plan-checkout";
import { logAutomation } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ planId: string }> };

export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: CHECKOUT_REDIRECT_HEADERS,
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
        // First-touch ?ref= has no aff_ref cookie on this request yet
        // (the proxy sets it on the response), so accept the query aliases.
        affiliateCode:
          search.get("affiliate_code") ??
          search.get("ref") ??
          search.get("aff") ??
          undefined,
      },
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      requireEmail: true,
    });
    if (!result.ok) {
      if (result.status === 303 && result.url) {
        const redirect = NextResponse.redirect(result.url, 303);
        for (const [key, value] of Object.entries(CHECKOUT_REDIRECT_HEADERS)) {
          redirect.headers.set(key, value);
        }
        return redirect;
      }
      return NextResponse.json(
        {
          error: result.error,
          ...(result.detail ? { detail: result.detail } : {}),
        },
        { status: result.status }
      );
    }
    const redirect = NextResponse.redirect(result.url, 303);
    for (const [key, value] of Object.entries(CHECKOUT_REDIRECT_HEADERS)) {
      redirect.headers.set(key, value);
    }
    return redirect;
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
