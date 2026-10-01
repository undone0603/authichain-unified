import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "../../../../../server/config/stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "../../../../utils/supabase/server";
import { safeReturnUrl } from "../../../../lib/safe-return-path";

/**
 * Open the Stripe billing portal for the signed-in customer.
 *
 * The customer is identified by their Supabase session, never by an email in
 * the request body: the portal can cancel plans, change cards and show
 * invoices, so it must only ever open for the account owner. The return URL is
 * pinned to our own origin.
 */
export async function POST(req: NextRequest) {
  const session = await createSessionClient();
  const { data } = (await session.auth?.getUser()) ?? { data: { user: null } };
  const email = data?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { brand, return_url } = await req.json().catch(() => ({}));

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("email", email)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No active subscription found for this account" },
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
      customer: subscription.stripe_customer_id,
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
