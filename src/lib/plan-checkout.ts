/**
 * Guest plan checkout for POST /api/checkout on the edge worker.
 * Price IDs come from `src/lib/plans.ts` only. Does not create a session
 * on GET — callers must POST a planId.
 */
import { getBrandIdFromRequest } from "./brand-billing";
import { hostedCheckoutRecoveryParams } from "./checkout-recovery";
import { checkoutNeedEmailRedirect, pickCheckoutEmail } from "./checkout-email";
import { PLANS, type PlanId } from "./plans";

export type PlanCheckoutOk = { ok: true; url: string; planId: string };
export type PlanCheckoutErr = {
  ok: false;
  status: 400 | 500 | 303;
  error: string;
  detail?: string;
  url?: string;
};
export type PlanCheckoutResult = PlanCheckoutOk | PlanCheckoutErr;

function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`))
    ?.slice(`${name}=`.length);
}

export async function createPlanCheckoutSession(opts: {
  request: Request;
  body: {
    planId?: string;
    email?: string;
    affiliateCode?: string;
    prospectId?: string;
    source?: string;
  };
  stripeSecretKey: string;
  /** GET attributed checkout must collect email; POST JSON may omit it. */
  requireEmail?: boolean;
}): Promise<PlanCheckoutResult> {
  const { request, body, stripeSecretKey } = opts;
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) {
    return { ok: false, status: 400, error: "planId is required" };
  }
  const plan = PLANS.find(p => p.id === (planId as PlanId));
  if (!plan) {
    return { ok: false, status: 400, error: "Unknown plan" };
  }
  if (!plan.stripe_price_id || !plan.stripe_mode) {
    return {
      ok: false,
      status: 400,
      error: "Free plan does not require checkout",
    };
  }

  const email = pickCheckoutEmail(
    typeof body.email === "string" ? body.email : ""
  );
  if (opts.requireEmail && !email) {
    const visitId =
      typeof body.prospectId === "string" ? body.prospectId.trim() : "";
    return {
      ok: false,
      status: 303,
      error: "email_required",
      url: checkoutNeedEmailRedirect("plan", visitId, plan.id),
    };
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieRef = readCookie(cookieHeader, "aff_ref");
  const affiliateCode = (
    body.affiliateCode ||
    (cookieRef ? decodeURIComponent(cookieRef) : "") ||
    ""
  )
    .trim()
    .slice(0, 64);
  const cookieReferral = readCookie(cookieHeader, "ref_code");
  const refCode = (cookieReferral ? decodeURIComponent(cookieReferral) : "")
    .trim()
    .slice(0, 64);
  const prospectId =
    typeof body.prospectId === "string"
      ? body.prospectId.trim().slice(0, 128)
      : "";
  const source =
    typeof body.source === "string" ? body.source.trim().slice(0, 64) : "";
  const brand = plan.brand ?? getBrandIdFromRequest(request);
  const origin =
    request.headers.get("origin") ||
    new URL(request.url).origin ||
    "https://authichain.govchain.us";

  if (!stripeSecretKey) {
    return { ok: false, status: 500, error: "Stripe is not configured" };
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: plan.stripe_mode,
      ...hostedCheckoutRecoveryParams(plan.stripe_mode),
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/dpp/thanks?session_id={CHECKOUT_SESSION_ID}${
        prospectId ? `&prospect_id=${encodeURIComponent(prospectId)}` : ""
      }${source ? `&utm_source=${encodeURIComponent(source)}` : ""}`,
      cancel_url: `${origin}/#pricing`,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        plan: plan.id,
        brand,
        ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
        ...(refCode ? { ref_code: refCode } : {}),
        ...(prospectId ? { prospect_id: prospectId } : {}),
        ...(source ? { source } : {}),
      },
      ...(plan.stripe_mode === "subscription"
        ? {
            subscription_data: {
              metadata: {
                plan: plan.id,
                brand,
                ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
                ...(refCode ? { ref_code: refCode } : {}),
                ...(prospectId ? { prospect_id: prospectId } : {}),
                ...(source ? { source } : {}),
              },
            },
          }
        : {}),
    });
    if (!session.url) {
      return {
        ok: false,
        status: 500,
        error: "Stripe did not return a checkout URL",
      };
    }
    return { ok: true, url: session.url, planId: plan.id };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      ok: false,
      status: 500,
      error: "Failed to start checkout",
      detail: err?.message,
    };
  }
}
