/**
 * DPP paid-session fulfillment: loop events + provisionPurchase + activate email.
 * Shared by the Next Stripe webhook and server/webhooks/stripe.ts so apex
 * checkout.session.completed actually grants access.
 *
 * The $299 charge opens a workspace with 50 generations. It is not an audit.
 */

import { provisionPurchase } from "./provisioning";
import { renderBillingEmail } from "./billing-emails";
import { getBrandIdFromMetadata } from "./brand-billing";
import { sendEmail } from "./email";
import {
  dppActivateUrl,
  isDppDemoSession,
  isDppOffer,
  recordDppLoopEventOnce,
} from "./dpp-loop";

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type DppCheckoutSessionLike = {
  id: string;
  mode?: string | null;
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
  session: DppCheckoutSessionLike,
  priceId?: string | null
): Promise<{ handled: boolean; profileId: string | null }> {
  const md = session.metadata || {};
  const linePriceId =
    (typeof priceId === "string" && priceId) ||
    (typeof md.stripe_price_id === "string" ? md.stripe_price_id : null);
  if (!isDppOffer(md, linePriceId)) {
    return { handled: false, profileId: null };
  }

  const subscriptionId = toId(session.subscription);
  if (session.mode === "subscription" || subscriptionId) {
    console.error(
      `[dpp-fulfill] refusing DPP grant for recurring checkout: session=${session.id} mode=${session.mode ?? "unknown"}`
    );
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
  const demo = isDppDemoSession(md);
  const loopMeta = {
    plan,
    brand,
    amount_total: session.amount_total,
    ...(demo ? { is_demo: true } : {}),
  };

  if (visitId) {
    await recordDppLoopEventOnce(supabase, {
      visitId: String(visitId),
      stage: "payment_succeeded",
      source: md.source || "direct",
      email: email || null,
      stripeSessionId: session.id,
      dedupeKey: session.id,
      metadata: loopMeta,
    });
  }

  const prov = await provisionPurchase(supabase, {
    email: email || null,
    userId: md.user_id || null,
    plan,
    brand,
    stripeCustomerId: toId(session.customer),
    stripeSubscriptionId: toId(session.subscription),
    stripeSessionId: session.id,
  });

  if (visitId && prov.profileId) {
    await recordDppLoopEventOnce(supabase, {
      visitId: String(visitId),
      stage: "provisioned",
      source: md.source || "direct",
      email: email || null,
      profileId: prov.profileId,
      stripeSessionId: session.id,
      dedupeKey: session.id,
      metadata: {
        created: prov.created,
        plan,
        ...(demo ? { is_demo: true } : {}),
      },
    });
  } else if (visitId && prov.status === "no_identity") {
    await recordDppLoopEventOnce(supabase, {
      visitId: String(visitId),
      stage: "provisioned",
      source: md.source || "direct",
      email: email || null,
      stripeSessionId: session.id,
      dedupeKey: session.id,
      metadata: {
        skip_reason: "no_identity",
        plan,
        ...(demo ? { is_demo: true } : {}),
      },
    });
  } else if (prov.status === "upsert_failed") {
    throw new Error(
      `DPP provision failed: ${prov.error || "profiles upsert failed"}`
    );
  }

  if (prov.profileId && email && !demo) {
    const mail = renderBillingEmail("dpp_audit_provisioned", brand, {
      planName: "EU DPP Workspace",
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
