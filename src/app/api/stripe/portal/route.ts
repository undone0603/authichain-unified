import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "../../../../../server/config/stripe";
import { createClient as createSessionClient } from "../../../../utils/supabase/server";
import { findProfileForUser } from "../../../../lib/profile-lookup";
import { safeReturnUrl } from "../../../../lib/safe-return-path";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * Open the Stripe billing portal for the signed-in customer.
 *
 * The customer is identified by their Supabase session, never by an email in
 * the request body: the portal can cancel plans, change cards and show
 * invoices, so it must only ever open for the account owner. The return URL is
 * pinned to our own origin.
 *
 * The Stripe customer id is read from profiles, which the live webhook
 * maintains (provisioning.ts). The legacy subscriptions table was only written
 * by the retired /api/webhooks/stripe handler, so no new customer was in it.
 */
export async function POST(req: NextRequest) {
  const session = await createSessionClient();
  const { data } = (await session.auth?.getUser()) ?? { data: { user: null } };
  const user = data?.user;
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { brand, return_url } = await req.json().catch(() => ({}));

    const profile = await findProfileForUser<{
      stripe_customer_id: string | null;
    }>(
      getSupabaseAdmin(),
      { id: user.id, email: user.email },
      "stripe_customer_id"
    );

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found for this account" },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const base_url =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://authichain.com";
    const fallback = `/dashboard?brand=${encodeURIComponent(
      typeof brand === "string" && brand ? brand : "authichain.com"
    )}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: safeReturnUrl(base_url, return_url, fallback),
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    console.error("[stripe/portal] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
