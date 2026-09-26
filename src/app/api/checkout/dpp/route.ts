/**
 * Attributed Checkout Session for the EU DPP Readiness Audit ($299).
 *
 * GET /api/checkout/dpp?... → 303 to the click-to-confirm page
 * https://authichain.com/checkout/dpp_readiness (its POST creates the
 * session). Only the DPP-SMOKE-E2E $0 demo still opens a session on GET.
 *
 * Canonical session create lives in `src/lib/dpp-checkout.ts` (also used by
 * worker-app). Do not fork price/metadata here.
 */

import { NextRequest, NextResponse } from "next/server";
import { CHECKOUT_REDIRECT_HEADERS } from "@/lib/checkout-email";
import { createDppCheckoutSession, isDppSmokePromo } from "@/lib/dpp-checkout";
import { gatedConfirmUrl } from "@/lib/checkout-gate";
import { logAutomation } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getServiceSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: CHECKOUT_REDIRECT_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  if (!isDppSmokePromo(request.nextUrl.searchParams.get("promo"))) {
    const redirect = NextResponse.redirect(
      gatedConfirmUrl("dpp_readiness", request.nextUrl.searchParams),
      303
    );
    for (const [key, value] of Object.entries(CHECKOUT_REDIRECT_HEADERS)) {
      redirect.headers.set(key, value);
    }
    return redirect;
  }
  try {
    const result = await createDppCheckoutSession({
      searchParams: request.nextUrl.searchParams,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      supabase: await getServiceSupabase(),
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
