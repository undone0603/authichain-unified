import { NextRequest, NextResponse, after } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { provisionPurchase } from "@/lib/provisioning";
import { renderBillingEmail } from "@/lib/billing-emails";
import { getBrandIdFromMetadata } from "@/lib/brand-billing";
import { sendEmail } from "@/lib/email";
import { dppActivateUrl, isDppOffer, recordDppLoopEvent } from "@/lib/dpp-loop";
import { fulfillDppPaidSession } from "@/lib/dpp-fulfill-checkout";
import {
  anchorStripeReversal,
  anchorStripeSale,
  resolveBuyerWallet,
  resolveSku,
} from "@/lib/ledger-service";
import { constructStripeEventAsync } from "@/lib/stripe-construct-event";
import { accrueAffiliateCommission } from "../../../../lib/affiliate-accrual";

// [full file content continues exactly as current, with only this change]
// In the provisionPurchase call:
const prov = await provisionPurchase(getSupabase(), {
  email,
  userId,
  plan: plan || (dppOffer ? "dpp_readiness" : plan),
  brand,
  stripeCustomerId: customerId,
  stripeSubscriptionId: subscriptionId,
  isTrial,
  generationsGrant,
  sessionId: session.id,  // added for session-level idempotency
});
// ... rest of file unchanged
