import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { findProfileForUser } from "../../../lib/profile-lookup";
import {
  GATED_CHECKOUT_ORIGIN,
  listedPlans,
  planPaymentLink,
} from "../../../lib/plans";

/**
 * The caller's subscription, and the plans on sale.
 *
 * This route used to return two fixture subscriptions to anyone (filterable by
 * any user_id), a plan list ($29 / $79 / $299) that is not in plans.ts, and a
 * POST that "created" an active subscription without charging. It now reads
 * the real entitlement record (profiles, maintained by the Stripe webhook)
 * for the signed-in user, and lists plans from src/lib/plans.ts.
 */

const ENTITLED_STATUSES = new Set(["active", "trialing"]);

type SubscriptionProfile = {
  subscription_plan: string | null;
  subscription_status: string | null;
};

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("type") === "plans") {
    return NextResponse.json({
      plans: listedPlans().map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        price_suffix: plan.price_suffix ?? null,
        description: plan.description,
        features: plan.features,
        checkout_url: planPaymentLink(plan.id) ?? null,
      })),
    });
  }

  const session = await createClient();
  const { data } = (await session.auth?.getUser()) ?? { data: { user: null } };
  const user = data?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await findProfileForUser<SubscriptionProfile>(
    getSupabaseAdmin(),
    user,
    "subscription_plan, subscription_status"
  );
  const status = profile?.subscription_status ?? null;
  return NextResponse.json(
    {
      plan: profile?.subscription_plan ?? null,
      status,
      entitled: ENTITLED_STATUSES.has(status ?? ""),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export function POST() {
  return NextResponse.json(
    {
      error: `Subscriptions are created by checkout, not this API. Use ${GATED_CHECKOUT_ORIGIN}/checkout/<plan_id> (plans in src/lib/plans.ts).`,
    },
    { status: 410 }
  );
}
