import { NextResponse } from "next/server";
import { GATED_CHECKOUT_ORIGIN } from "../../../../lib/plans";

/**
 * Closed. The previous handler created Stripe subscription sessions from
 * env-mapped price IDs (server/config/stripe.ts), bypassing src/lib/plans.ts,
 * which is the source of truth for anything that charges. Nothing in the repo
 * called it. Checkout goes through the gated /checkout/<plan_id> path.
 */
export function POST() {
  return NextResponse.json(
    {
      error: `Closed. Use ${GATED_CHECKOUT_ORIGIN}/checkout/<plan_id> (plans in src/lib/plans.ts).`,
    },
    { status: 410 }
  );
}
