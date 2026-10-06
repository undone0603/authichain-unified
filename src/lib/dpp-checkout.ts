/**
 * Shared DPP $299 Checkout Session create.
 *
 * Paid return is https://authichain.com/onboard. No Basic credit.
 * Price comes from src/lib/plans.ts only.
 */

import { hostedCheckoutRecoveryParams } from "./checkout-recovery";
import { checkoutNeedEmailRedirect, pickCheckoutEmail } from "./checkout-email";
import { gatedConfirmUrl } from "./checkout-gate";
import { DPP_OFFER_KEY, PLANS } from "./plans";
import { CASH_CANCEL_URL, CASH_SUCCESS_URL } from "./cash-entitlement";
import {
  DPP_SMOKE_PROMO,
  dppSmokeRequestAuthorized,
  isDppSmokePromo,
  recordDppLoopEvent,
} from "./dpp-loop";

export const DPP_CHECKOUT_ORIGIN = "https://authichain.com";
export { DPP_SMOKE_PROMO, dppSmokeRequestAuthorized, isDppSmokePromo };

const PLAN = PLANS.find(p => p.id === "dpp_readiness");

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type DppCheckoutOk = { ok: true; url: string; visitId: string };
export type DppCheckoutErr = {
  ok: false;
  status: 500 | 303;
  error: string;
  detail?: string;
  url?: string;
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
  smokeAuthorized?: boolean;
}): Promise<DppCheckoutResult> {
  const { searchParams, stripeSecretKey, supabase } = opts;

  const visitId =
    pick(searchParams, "visit_id") ||
    pick(searchParams, "prospect_id") ||
    newDppVisitId();
  const email = pickCheckoutEmail(pick(searchParams, "email", 254));
  const utmSource = pick(searchParams, "utm_source", 64);
  const utmMedium = pick(searchParams, "utm_medium", 64);
  const utmCampaign = pick(searchParams, "utm_campaign", 128);
  const utmContent = pick(searchParams, "utm_content", 128);
  const utmTerm = pick(searchParams, "utm_term", 128);
  const referrer = pick(searchParams, "referrer", 512);
  const source = utmSource || pick(searchParams, "source", 64) || "direct";
  const smoke = isDppSmokePromo(pick(searchParams, "promo", 32));
  if (smoke && opts.smokeAuthorized !== true) {
    return {
      ok: false,
      status: 303,
      error: "smoke_unauthorized",
      url: gatedConfirmUrl("dpp_readiness", searchParams),
    };
  }
  const affiliateCode =
    pick(searchParams, "affiliate_code", 64) ||
    pick(searchParams, "ref", 64) ||
    pick(searchParams, "aff", 64);
  const refCode = pick(searchParams, "ref_code", 64);

  if (!email && !smoke) {
    return {
      ok: false,
      status: 303,
      error: "email_required",
      url: checkoutNeedEmailRedirect("dpp", visitId),
    };
  }

  if (!stripeSecretKey) {
    return { ok: false, status: 500, error: "Stripe is not configured" };
  }
  if (!PLAN?.stripe_price_id || PLAN.stripe_mode !== "payment") {
    return { ok: false, status: 500, error: "DPP offer is not configured" };
  }

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

  const successUrl = `${CASH_SUCCESS_URL}&visit_id=${encodeURIComponent(visitId)}`;
  const cancelUrl = `${CASH_CANCEL_URL}?cancelled=1&visit_id=${encodeURIComponent(visitId)}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...hostedCheckoutRecoveryParams("payment"),
      line_items: smoke
        ? [
            {
              price_data: {
                currency: "usd",
                product_data: { name: "EU DPP Workspace (smoke)" },
                unit_amount: 0,
              },
              quantity: 1,
            },
          ]
        : [{ price: PLAN.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: visitId.slice(0, 200),
      ...(email ? { customer_email: email } : {}),
      metadata: {
        plan: PLAN.id,
        brand: "authichain",
        offer: DPP_OFFER_KEY,
        ...(PLAN.stripe_price_id
          ? { stripe_price_id: PLAN.stripe_price_id }
          : {}),
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
        ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
        ...(refCode ? { ref_code: refCode } : {}),
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
