/**
 * Attributed Checkout Session for the EU DPP Readiness Audit ($299).
 *
 * GET /api/checkout/dpp?... → 303 to Stripe Checkout
 *
 * Canonical session create lives in `src/lib/dpp-checkout.ts` (also used by
 * worker-app). Do not fork price/metadata here.
 */

import { NextRequest, NextResponse } from "next/server";
import { createDppCheckoutSession } from "@/lib/dpp-checkout";
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
    headers: {
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const result = await createDppCheckoutSession({
      searchParams: request.nextUrl.searchParams,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      supabase: await getServiceSupabase(),
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
