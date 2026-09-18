/**
 * DPP paid-session fulfillment: loop events + provisionPurchase + activate email.
 * Shared by the Next Stripe webhook and server/webhooks/stripe.ts so apex
 * checkout.session.completed actually grants access.
 */

import { provisionPurchase } from "./provisioning";
import { renderBillingEmail } from "./billing-emails";
import { getBrandIdFromMetadata } from "./brand-billing";
import { sendEmail } from "./email";
import { dppActivateUrl, isDppOffer, recordDppLoopEvent } from "./dpp-loop";

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type DppCheckoutSessionLike = {
  id: string;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  amount_total?: number | null;
};

function toId(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function fulfillDppPaidSession(
  supabase: SupabaseLike,
  session: DppCheckoutSessionLike
): Promise<{ handled: boolean; profileId: string | null }> {
  const md = session.metadata || {};
  const linePriceId =
    typeof md.stripe_price_id === "string" ? md.stripe_price_id : null;
  if (!isDppOffer(md, linePriceId)) {
    return { handled: false, profileId: null };
  }

  const visitId =
    md.visit_id || md.prospect_id || session.client_reference_id || null;
  const email = (
    session.customer_email ||
    session.customer_details?.email ||
    ""
  )
    .toLowerCase()
    .trim();
  const brand = getBrandIdFromMetadata(md);
  const plan = md.plan || "dpp_readiness";

  if (visitId) {
    await recordDppLoopEvent(supabase, {
      visitId: String(visitId),
      stage: "payment_succeeded",
      source: md.source || "direct",
      email: email || null,
      stripeSessionId: session.id,
      metadata: { plan, brand, amount_total: session.amount_total },
    });
  }

  const prov = await provisionPurchase(supabase, {
    email: email || null,
    userId: md.user_id || null,
    plan,
    brand,
    stripeCustomerId: toId(session.customer),
    stripeSubscriptionId: toId(session.subscription),
  });

  if (prov.profileId && visitId) {
    await recordDppLoopEvent(supabase, {
      visitId: String(visitId),
      stage: "provisioned",
      source: md.source || "direct",
      email: email || null,
      profileId: prov.profileId,
      stripeSessionId: session.id,
      metadata: { created: prov.created, plan },
    });
  }

  if (prov.profileId && email) {
    const mail = renderBillingEmail("dpp_audit_provisioned", brand, {
      planName: "EU DPP Readiness Audit",
      activateUrl: dppActivateUrl(session.id, visitId ? String(visitId) : null),
    });
    await sendEmail({
      to: email,
      from: mail.from,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }).catch(() => {});
  }

  return { handled: true, profileId: prov.profileId };
}
