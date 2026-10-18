/**
 * Click-to-confirm checkout gate.
 *
 * Why: Sep 20-25 2026 - 98 of the last 100 live Checkout Sessions expired
 * unpaid, 85 with no email. One-click GET links (/api/checkout/*, and raw
 * buy.stripe.com Payment Links, which also open a session on GET) were being
 * opened by link scanners, email security gateways and chat link previews.
 *
 * Rule: a GET/HEAD never calls Stripe. GET renders a confirm page with a POST
 * form; only a POST from that form (valid email, not a bot, not a prefetch)
 * creates a Checkout Session.
 *
 * Stable public path (Marketing drafts, sites, outreach):
 *   https://authichain.com/checkout          -> plan chooser
 *   https://authichain.com/checkout/<planId> -> confirm page for one plan
 *   optional ?email=you@co.com&utm_*=...&visit_id=... prefill the form.
 */

import { applyHostedCheckoutRecovery } from "./checkout-recovery";
import {
  claimCheckoutAttempt,
  recordCheckoutSession,
} from "./checkout-protection";
import {
  checkoutViewEvent,
  isDeclaredFor,
  isGrowthSku,
  type GrowthSku,
} from "./growth/emit";
import { getPlanByPublicSlug, GATED_CHECKOUT_ORIGIN } from "./plans";

export interface GatedCheckoutParams {
  planId: string;
  email: string;
  checkoutKey: string;
  request: Request;
  origin?: string;
}

export type GatedCheckoutResult =
  | { ok: true; url: string; sessionId?: string }
  | { ok: false; status: number; error: string; detail?: string };

export async function createGatedCheckoutSession(
  params: GatedCheckoutParams
): Promise<GatedCheckoutResult> {
  const plan = getPlanByPublicSlug(params.planId);
  if (!plan) {
    return { ok: false, status: 404, error: "Invalid plan identifier" };
  }

  const claim = await claimCheckoutAttempt({
    checkoutKey: params.checkoutKey,
    email: params.email,
    planId: plan.id,
    request: params.request,
  });

  if (!claim.allowed) {
    return {
      ok: false,
      status: 429,
      error: claim.reason || "Rate limit or duplicate checkout attempt",
    };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return {
      ok: false,
      status: 500,
      error: "Stripe integration is not configured",
    };
  }

  const origin =
    params.origin ||
    GATED_CHECKOUT_ORIGIN ||
    new URL(params.request.url).origin;

  const successUrl = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/checkout/${plan.id}?cancelled=1`;

  const body = new URLSearchParams();
  body.append("mode", "subscription");
  body.append("success_url", successUrl);
  body.append("cancel_url", cancelUrl);
  body.append("customer_email", params.email);
  body.append("line_items[0][price]", plan.stripe_price_id);
  body.append("line_items[0][quantity]", "1");
  body.append("metadata[plan_id]", plan.id);
  body.append("metadata[checkout_key]", params.checkoutKey);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[checkout] Stripe API error:", res.status, errText);
    return {
      ok: false,
      status: 502,
      error: "Stripe API error",
      detail: errText,
    };
  }

  const data = (await res.json()) as { id: string; url: string };

  try {
    const recorded = await recordCheckoutSession(params.checkoutKey, data.url);
    if (!recorded) {
      console.warn(
        `[checkout] Failed to record checkout session ${data.id} for key ${params.checkoutKey}, proceeding with session URL`
      );
    }
  } catch (err) {
    console.warn(
      `[checkout] Error recording checkout session ${data.id} for key ${params.checkoutKey}:`,
      err
    );
  }

  return { ok: true, url: data.url, sessionId: data.id };
}

export async function tryHandleGatedCheckout(
  req: Request
): Promise<Response | null> {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/checkout\/([a-zA-Z0-9_-]+)$/);
  if (!match && url.pathname !== "/checkout") return null;

  const planId = match ? match[1] : "starter";
  const plan = getPlanByPublicSlug(planId);
  if (!plan) return null;

  if (req.method === "POST") {
    const formData = await req.formData();
    const email = formData.get("email")?.toString().trim() || "";
    const checkoutKey = formData.get("checkout_key")?.toString().trim() || "";

    if (!email) {
      return new Response("Email is required", { status: 400 });
    }

    const result = await createGatedCheckoutSession({
      planId,
      email,
      checkoutKey: checkoutKey || `${Date.now()}-${Math.random()}`,
      request: req,
    });

    if (!result.ok) {
      console.error(
        `[checkout] Gated checkout failed: ${result.error}${
          result.detail ? ": " + result.detail : ""
        }`
      );
      const errDetail = `[${result.error}${
        result.detail ? ": " + result.detail : ""
      }]`;
      return new Response(
        `<html><body><h1>Checkout Error</h1><p>Unable to create checkout session. ${errDetail}</p></body></html>`,
        {
          status: result.status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-Checkout-Error": `${result.error} ${errDetail}`,
          },
        }
      );
    }

    return Response.redirect(result.url, 303);
  }

  return null;
}
