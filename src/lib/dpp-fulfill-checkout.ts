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
): Promise<DppFulfillResult> {
  const md = session.metadata || {};
  const linePriceId =
    (typeof priceId === "string" && priceId) ||
    (typeof md.stripe_price_id === "string" ? md.stripe_price_id : null);
  if (!isDppOffer(md, linePriceId)) {
    return { handled: false, profileId: null, activationEmail: "skipped" };
  }

  const subscriptionId = toId(session.subscription);
  if (session.mode === "subscription" || subscriptionId) {
    console.error(
      `[dpp-fulfill] refusing DPP grant for recurring checkout: session=${session.id} mode=${session.mode ?? "unknown"}`
    );
    return { handled: false, profileId: null, activationEmail: "skipped" };
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

  let activationEmail: ActivationEmailStatus = "skipped";
  if (prov.profileId && email && !demo) {
    const mail = renderBillingEmail("dpp_audit_provisioned", brand, {
      planName: "EU DPP Readiness",
      activateUrl: dppActivateUrl(session.id, visitId ? String(visitId) : null),
    });
    // A paid buyer who never gets this email has no way into the workspace, so
    // a failed send must be visible (log + funnel_events row), never swallowed.
    // The payment and the grant above are already done; we do not throw here,
    // because a Stripe retry would re-run provisioning, not just the email.
    let result: { ok: boolean; provider?: string; status?: number; error?: string };
    try {
      result = await sendEmail({
        to: email,
        from: mail.from,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    if (result && result.ok) {
      activationEmail = "sent";
    } else {
      activationEmail = "failed";
      const reason = redactForLog(result?.error ?? "no send result");
      // No recipient address in logs: session and profile ids are enough to
      // find the buyer from the service side.
      console.error(
        `[dpp-fulfill] activation email failed: session=${session.id} profile=${prov.profileId} provider=${result?.provider ?? "unknown"} status=${result?.status ?? "n/a"} reason=${reason}`
      );
      await recordActivationEmailFailed(supabase, {
        prospectId: visitId ? String(visitId) : session.id,
        source: md.source || "direct",
        stripeSessionId: session.id,
        profileId: prov.profileId,
        provider: result?.provider ?? null,
        httpStatus: result?.status ?? null,
        reason,
      });
    }
  }

  return { handled: true, profileId: prov.profileId, activationEmail };
}

export type ActivationEmailStatus = "sent" | "failed" | "skipped";

export type DppFulfillResult = {
  handled: boolean;
  profileId: string | null;
  /** Outcome of the activation email: skipped = not attempted (no email, demo, or not a DPP grant). */
  activationEmail: ActivationEmailStatus;
};

const EMAIL_LIKE = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+/g;

/** Strip anything address-shaped from a provider error and cap its length. */
export function redactForLog(message: string | undefined | null): string {
  if (!message) return "unknown";
  return message.replace(EMAIL_LIKE, "[redacted]").replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Durable failed-status record for a dead activation email. Deliberately not a
 * dpp_loop:* event and no metadata.loop_stage, so loop reconstruction and stall
 * reports are unchanged. No email address is stored. Never throws.
 */
async function recordActivationEmailFailed(
  supabase: SupabaseLike,
  input: {
    prospectId: string;
    source: string;
    stripeSessionId: string;
    profileId: string | null;
    provider: string | null;
    httpStatus: number | null;
    reason: string;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("funnel_events").insert({
      prospect_id: input.prospectId,
      stage: "complete_checkout",
      source: ["seo", "direct", "email", "affiliate", "linkedin_post", "reddit_post", "gov_engine"].includes(input.source)
        ? input.source
        : "direct",
      event_type: "dpp_activation_email:failed",
      metadata: {
        activation_email_status: "failed",
        stripe_session_id: input.stripeSessionId,
        ...(input.profileId ? { profile_id: input.profileId } : {}),
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.httpStatus != null ? { http_status: input.httpStatus } : {}),
        reason: input.reason,
      },
      timestamp: new Date().toISOString(),
    });
    if (error) {
      console.error(
        `[dpp-fulfill] could not record activation email failure: session=${input.stripeSessionId}`,
        error?.message ?? error
      );
    }
  } catch (err) {
    console.error(
      `[dpp-fulfill] could not record activation email failure: session=${input.stripeSessionId}`,
      err instanceof Error ? err.message : err
    );
  }
}
