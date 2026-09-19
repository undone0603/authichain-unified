/**
 * Shared DPP $299 Checkout Session create.
 *
 * Used by Next `src/app/api/checkout/dpp` and `worker-app` GET /api/checkout/dpp
 * so the edge worker does not fork money logic. Totals/price come from
 * `src/lib/plans.ts` only.
 */

import { DPP_OFFER_KEY, PLANS } from "./plans";
import {
  DPP_SMOKE_PROMO,
  isDppSmokePromo,
  recordDppLoopEvent,
} from "./dpp-loop";

export const DPP_CHECKOUT_ORIGIN = "https://authichain.com";
export { DPP_SMOKE_PROMO, isDppSmokePromo };

const PLAN = PLANS.find(p => p.id === "dpp_readiness");

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type DppCheckoutOk = { ok: true; url: string; visitId: string };
export type DppCheckoutErr = {
  ok: false;
  status: 500;
  error: string;
  detail?: string;
};
export type DppCheckoutResult = DppCheckoutOk | DppCheckoutErr;

function pick(params: URLSearchParams, key: string, max = 128): string {
  return (params.get(key) || "").trim().slice(0, max);
}

export function newDppVisitId(): string {
  return `dpp_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

export async function createDppCheckoutSession(opts: {
  searchParams: URLSearchParams;
  stripeSecretKey: string;
  supabase?: SupabaseLike | null;
  origin?: string;
}): Promise<DppCheckoutResult> {
  const { searchParams, stripeSecretKey, supabase } = opts;
  const origin = opts.origin || DPP_CHECKOUT_ORIGIN;

  if (!stripeSecretKey) {
    return { ok: false, status: 500, error: "Stripe is not configured" };
  }
  if (!PLAN?.stripe_price_id || PLAN.stripe_mode !== "payment") {
    return { ok: false, status: 500, error: "DPP offer is not configured" };
  }

  const visitId =
    pick(searchParams, "visit_id") ||
    pick(searchParams, "prospect_id") ||
    newDppVisitId();
  const email = pick(searchParams, "email", 254);
  const utmSource = pick(searchParams, "utm_source", 64);
  const utmMedium = pick(searchParams, "utm_medium", 64);
  const utmCampaign = pick(searchParams, "utm_campaign", 128);
  const utmContent = pick(searchParams, "utm_content", 128);
  const utmTerm = pick(searchParams, "utm_term", 128);
  const referrer = pick(searchParams, "referrer", 512);
  const source = utmSource || pick(searchParams, "source", 64) || "direct";
  const smoke = isDppSmokePromo(pick(searchParams, "promo", 32));

  if (supabase) {
    await recordDppLoopEvent(supabase, {
      visitId,
      stage: "checkout_started",
      source,
      metadata: {
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        utm_content: utmContent || null,
        utm_term: utmTerm || null,
        referrer: referrer || null,
      },
    });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-08-26.dahlia" as const,
  });

  const successUrl = `${origin}/dpp/thanks?session_id={CHECKOUT_SESSION_ID}&visit_id=${encodeURIComponent(visitId)}`;
  const cancelUrl = `${origin}/dpp?cancelled=1&visit_id=${encodeURIComponent(visitId)}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: smoke
        ? [
            {
              price_data: {
                currency: "usd",
                product_data: { name: "EU DPP Readiness Audit (smoke)" },
                unit_amount: 0,
              },
              quantity: 1,
            },
          ]
        : [{ price: PLAN.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: smoke ? undefined : true,
      client_reference_id: visitId.slice(0, 200),
      ...(email ? { customer_email: email } : {}),
      metadata: {
        plan: PLAN.id,
        brand: "authichain",
        offer: DPP_OFFER_KEY,
        prospect_id: visitId,
        visit_id: visitId,
        source,
        ...(smoke ? { is_demo: "true", promo: DPP_SMOKE_PROMO } : {}),
        ...(utmSource ? { utm_source: utmSource } : {}),
        ...(utmMedium ? { utm_medium: utmMedium } : {}),
        ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
        ...(utmContent ? { utm_content: utmContent } : {}),
        ...(utmTerm ? { utm_term: utmTerm } : {}),
        ...(referrer ? { referrer: referrer } : {}),
      },
    });

    if (!session.url) {
      return { ok: false, status: 500, error: "Checkout session missing URL" };
    }
    return { ok: true, url: session.url, visitId };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    console.error("[checkout/dpp] Error:", error);
    return {
      ok: false,
      status: 500,
      error: "Failed to start DPP checkout",
      detail: err?.message,
    };
  }
}
