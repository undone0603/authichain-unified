/**
 * Edge checkout for the $299 DPP audit.
 * GET /protocol/checkout/dpp — never cached as landing HTML (unlike /api/checkout/dpp).
 * Uses STRIPE_SECRET_KEY on authichain-com (bound from GitHub secrets at deploy).
 * Promo DPP-SMOKE-E2E creates a $0 one-time session (no live $299 charge).
 */
import { DPP_OFFER_KEY } from "../../../src/lib/plans";
import { DPP_SMOKE_PROMO, isDppSmokePromo } from "../../../src/lib/dpp-loop";

export const DPP_PRICE_ID = "price_1TwmD8GqTruSqV8TpAF8dfyA";
export const APP_ORIGIN = "https://authichain.com";

export type CheckoutEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
};

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function pick(params: URLSearchParams, key: string, max = 128): string {
  return (params.get(key) || "").trim().slice(0, max);
}

function newVisitId(): string {
  return `dpp_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

export function isProtocolCheckoutPath(pathname: string): boolean {
  return (
    pathname === "/protocol/checkout/dpp" ||
    pathname === "/protocol/checkout/dpp/"
  );
}

export async function tryHandleProtocolCheckout(
  request: Request,
  env: CheckoutEnv
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isProtocolCheckoutPath(url.pathname)) return null;
  if (request.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
      },
    });
  }
  if (request.method !== "GET") {
    return json(405, { error: "method not allowed" });
  }

  const key = (env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    return json(500, { error: "Stripe is not configured" });
  }

  const params = url.searchParams;
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
  const smoke = isDppSmokePromo(pick(params, "promo", 32));
  const priceId = (env.STRIPE_PRICE_ID || DPP_PRICE_ID).trim();

  const body = new URLSearchParams();
  body.set("mode", "payment");
  if (smoke) {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set(
      "line_items[0][price_data][product_data][name]",
      "EU DPP Readiness Audit (smoke)"
    );
    body.set("line_items[0][price_data][unit_amount]", "0");
    body.set("line_items[0][quantity]", "1");
  } else {
    body.set("line_items[0][price]", priceId);
    body.set("line_items[0][quantity]", "1");
    body.set("allow_promotion_codes", "true");
  }
  body.set(
    "success_url",
    `${APP_ORIGIN}/dpp/thanks?session_id={CHECKOUT_SESSION_ID}&visit_id=${encodeURIComponent(visitId)}`
  );
  body.set(
    "cancel_url",
    `${APP_ORIGIN}/dpp?cancelled=1&visit_id=${encodeURIComponent(visitId)}`
  );
  body.set("client_reference_id", visitId.slice(0, 200));
  if (email) body.set("customer_email", email);
  body.set("metadata[plan]", "dpp_readiness");
  body.set("metadata[brand]", "authichain");
  body.set("metadata[offer]", DPP_OFFER_KEY);
  body.set("metadata[prospect_id]", visitId);
  body.set("metadata[visit_id]", visitId);
  body.set("metadata[source]", source);
  if (smoke) {
    body.set("metadata[is_demo]", "true");
    body.set("metadata[promo]", DPP_SMOKE_PROMO);
  }
  if (utmSource) body.set("metadata[utm_source]", utmSource);
  if (utmMedium) body.set("metadata[utm_medium]", utmMedium);
  if (utmCampaign) body.set("metadata[utm_campaign]", utmCampaign);
  if (utmContent) body.set("metadata[utm_content]", utmContent);
  if (utmTerm) body.set("metadata[utm_term]", utmTerm);
  if (referrer) body.set("metadata[referrer]", referrer);

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await stripeRes.json()) as {
    url?: string;
    error?: { message?: string };
  };
  if (!stripeRes.ok || !data.url) {
    return json(500, {
      error: "Failed to start DPP checkout",
      detail: data.error?.message || `stripe ${stripeRes.status}`,
    });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: data.url,
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
    },
  });
}
