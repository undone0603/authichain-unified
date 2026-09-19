/**
 * Self-serve DPP merchant activation. Shared by Next and worker-app so apex
 * POST /api/dpp/activate is not a 404.
 */

import { dppActivateUrl, isDppOffer, recordDppLoopEvent } from "./dpp-loop";

export type DppActivateInput = {
  session_id?: string;
  visit_id?: string;
  categories?: string;
  markets?: string;
  labeling?: string;
  call_windows?: string;
};

export type DppActivateOk = {
  ok: true;
  profile_id: string | null;
  visit_id: string;
  already_activated: boolean;
  next: string;
  activate_url: string;
};

export type DppActivateErr = {
  ok: false;
  status: number;
  error: string;
  detail?: string;
};

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export async function activateDppMerchant(opts: {
  body: DppActivateInput;
  stripeSecretKey: string;
  supabase: SupabaseLike | null;
}): Promise<DppActivateOk | DppActivateErr> {
  const sessionId = (opts.body.session_id || "").trim();
  if (!sessionId) {
    return { ok: false, status: 400, error: "session_id is required" };
  }

  const categories = (opts.body.categories || "").trim();
  const markets = (opts.body.markets || "").trim();
  const labeling = (opts.body.labeling || "").trim();
  if (!categories || !markets || !labeling) {
    return {
      ok: false,
      status: 400,
      error: "categories, markets, and labeling are required",
    };
  }

  if (!opts.stripeSecretKey) {
    return { ok: false, status: 500, error: "Stripe is not configured" };
  }
  if (!opts.supabase) {
    return { ok: false, status: 500, error: "Database not configured" };
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(opts.stripeSecretKey, {
    apiVersion: "2026-08-26.dahlia" as const,
  });

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { ok: false, status: 402, error: "Checkout session is not paid" };
  }

  const md = (session.metadata || {}) as Record<string, unknown>;
  if (
    !isDppOffer(md) &&
    session.amount_total !== 29900 &&
    session.amount_total !== 0
  ) {
    return { ok: false, status: 400, error: "Not a DPP audit session" };
  }

  const email = (
    session.customer_details?.email ||
    session.customer_email ||
    ""
  )
    .toLowerCase()
    .trim();
  const visitId =
    (opts.body.visit_id || "").trim() ||
    String(
      md.visit_id || md.prospect_id || session.client_reference_id || sessionId
    );

  let profileId: string | null = null;
  if (email) {
    const { data: profile } = await opts.supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    profileId = (profile?.id as string) || null;
  }

  const { data: prior } = await opts.supabase
    .from("funnel_events")
    .select("id, metadata")
    .eq("prospect_id", visitId)
    .eq("event_type", "dpp_loop:merchant_activated")
    .order("timestamp", { ascending: false })
    .limit(5);

  const alreadyActivated = Array.isArray(prior)
    ? prior.some(
        (row: { metadata?: { stripe_session_id?: string } }) =>
          row?.metadata?.stripe_session_id === sessionId
      )
    : false;

  if (!alreadyActivated) {
    await recordDppLoopEvent(opts.supabase, {
      visitId,
      stage: "merchant_activated",
      source: String(md.source || "direct"),
      email,
      profileId,
      stripeSessionId: sessionId,
      metadata: {
        categories,
        markets,
        labeling,
        call_windows: (opts.body.call_windows || "").trim() || null,
        activated_at: new Date().toISOString(),
      },
    });
  }

  return {
    ok: true,
    profile_id: profileId,
    visit_id: visitId,
    already_activated: alreadyActivated,
    next: "/dashboard",
    activate_url: dppActivateUrl(sessionId, visitId),
  };
}
