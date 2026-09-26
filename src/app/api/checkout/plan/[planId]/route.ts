/**
 * Catalogue plan checkout — GET is click-to-confirm.
 *
 * GET /api/checkout/plan/:planId → 303 to https://authichain.com/checkout/:planId
 * (confirm page; its POST form creates the Stripe session). A GET never opens
 * a Checkout Session — link scanners and previews were creating unpaid carts.
 */

import { NextRequest, NextResponse } from "next/server";
import { CHECKOUT_REDIRECT_HEADERS } from "@/lib/checkout-email";
import {
  GATED_CHECKOUT_ORIGIN,
  gatedConfirmUrl,
  planFromGatedPath,
} from "@/lib/checkout-gate";

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
  const plan = planFromGatedPath(`/checkout/${planId}`);
  const target = plan
    ? gatedConfirmUrl(plan.id, request.nextUrl.searchParams)
    : `${GATED_CHECKOUT_ORIGIN}/checkout`;
  const redirect = NextResponse.redirect(target, 303);
  for (const [key, value] of Object.entries(CHECKOUT_REDIRECT_HEADERS)) {
    redirect.headers.set(key, value);
  }
  return redirect;
}
