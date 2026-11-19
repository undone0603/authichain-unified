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
import { deliverDppActivationOnce, prepareDppActivation } from "./dpp-activation-outbox";
import { dppActivateUrl, recordDppLoopEventOnce } from "./dpp-loop";
import {
  beginProvisionContinuity,
  finishProvisionContinuity,
  provisionContinuityProfileId,
} from "./founder-exit/supabase-log";
import { markRetryableFulfillment } from "./retryable-fulfillment";
import {
  dppGrantDecision,
  dppInvalidSettlementIsPermanent,
  type DppProofSession,
} from "./dpp-payment-eligibility";
import { emitTrustEvent } from "../../shared/trust-events";

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type DppCheckoutSessionLike = DppProofSession & {
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  customer?: string | { id: string } | null;
};

function toId(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function findGrantedProfileId(
  supabase: SupabaseLike,
  sessionId: string
): Promise<string | null> {
  const recordedProfileId = await provisionContinuityProfileId(
    supabase,
    sessionId
  );
  if (recordedProfileId) return recordedProfileId;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("last_grant_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error("DPP grant recovery profile lookup failed");
  return typeof data?.id === "string" ? data.id : null;
}

async function recordRecoveredProvisionedEvent(
  supabase: SupabaseLike,
  input: {
    visitId: string | null;
    source: string;
    email: string;
    profileId: string | null;
    sessionId: string;
    plan: string;
    demo: boolean;
    allowNoIdentityDemo?: boolean;
  }
): Promise<void> {
  if (!input.visitId) return;
  if (!input.profileId && !(input.demo && input.allowNoIdentityDemo)) {
    throw new Error("DPP grant recovery profile not found");
  }

  await recordDppLoopEventOnce(supabase, {
    visitId: input.visitId,
    stage: "provisioned",
    source: input.source,
    email: input.email || null,
    profileId: input.profileId ?? undefined,
    stripeSessionId: input.sessionId,
    dedupeKey: input.sessionId,
    metadata: {
      plan: input.plan,
      ...(input.profileId
        ? { recovered: true }
        : { skip_reason: "no_identity" }),
      ...(input.demo ? { is_demo: true } : {}),
    },
  });
}

/**
 * Delivery is deliberately separate from the atomic entitlement grant.
 * Every path, including recovered continuity, reconciles the durable outbox.
 * No additional mail is sent after a provider outcome becomes ambiguous.
 */
async function deliverActivationAfterGrant(
  supabase: SupabaseLike,
  input: {
    sessionId: string;
    profileId: string | null;
    email: string;
    brand: ReturnType<typeof getBrandIdFromMetadata>;
    visitId: string | null;
    source: string;
    demo: boolean;
  }
): Promise<ActivationEmailStatus> {
  if (input.demo || !input.profileId) return "skipped";
  if (!input.email) {
    throw markRetryableFulfillment(
      new Error("DPP paid grant has no activation recipient; manual reconciliation required")
    );
  }
  const mail = renderBillingEmail("dpp_audit_provisioned", input.brand, {
    planName: "EU DPP Workspace",
    activateUrl: dppActivateUrl(input.sessionId, input.visitId),
  });
  let delivery: Awaited<ReturnType<typeof deliverDppActivationOnce>>;
  try {
    delivery = await deliverDppActivationOnce(
      supabase,
      { sessionId: input.sessionId, profileId: input.profileId, demo: false },
      () =>
        sendEmail(
          {
            to: input.email,
            from: mail.from,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          },
          { onlyProvider: "resend" }
        )
    );
  } catch (err) {
    // Before a provider attempt: Stripe can retry. After an ambiguous attempt
    // the SQL state stays 'sending' and replay returns 'held', never re-sends.
    throw markRetryableFulfillment(err);
  }
  if (delivery.status === "failed") {
    const reason = redactForLog(delivery.error ?? "provider outcome unknown");
    console.error(
      `[dpp-fulfill] activation email failed: session=${input.sessionId} profile=${input.profileId} provider=${delivery.provider || "unknown"} status=${delivery.httpStatus ?? "n/a"} reason=${reason}`
    );
    await recordActivationEmailFailed(supabase, {
      prospectId: input.visitId || input.sessionId,
      source: input.source,
      stripeSessionId: input.sessionId,
      profileId: input.profileId,
      provider: delivery.provider || null,
      httpStatus: delivery.httpStatus ?? null,
      reason,
    });
  } else if (delivery.status === "held") {
    console.warn(
      `[dpp-fulfill] activation delivery held for reconciliation: session=${input.sessionId} profile=${input.profileId}`
    );
  }
  return delivery.status;
}

export async function fulfillDppPaidSession(
  supabase: SupabaseLike,
  session: DppCheckoutSessionLike,
  priceId?: string | null
): Promise<DppFulfillResult> {
  try {
    const result = await fulfillDppPaidSessionOnce(supabase, session, priceId);
    if (result.refused) {
      emitTrustEvent("fulfillment.failed", {
        session_id: session.id,
        plan: session.metadata?.plan || "dpp_readiness",
        error_class: "IneligibleSettlement",
        outcome: "ineligible_settlement",
      });
      return result;
    }
    if (result.handled) {
      emitTrustEvent("fulfillment.completed", {
        session_id: session.id,
        profile_id: result.profileId,
        plan: session.metadata?.plan || "dpp_readiness",
        outcome: result.alreadyFulfilled
          ? `recovered_activation_email_${result.activationEmail}`
          : `activation_email_${result.activationEmail}`,
      });
    }
    return result;
  } catch (err) {
    emitTrustEvent("fulfillment.failed", {
      session_id: session.id,
      plan: session.metadata?.plan || "dpp_readiness",
      error_class: err instanceof Error ? err.name : "Error",
      outcome: "stripe_will_retry",
    });
    throw err;
  }
}

async function fulfillDppPaidSessionOnce(
  supabase: SupabaseLike,
  session: DppCheckoutSessionLike,
  priceId?: string | null
): Promise<DppFulfillResult> {
  // Legacy priceId is a routing hint, never Stripe-paid product evidence.
  void priceId;
  const md = session.metadata || {};
  const decision = dppGrantDecision(session);
  if (decision === "not_dpp" || decision === "recurring") {
    return { handled: false, profileId: null, activationEmail: "skipped" };
  }
  if (decision === "unverified" && session.payment_status !== "paid") {
    // Async payment can complete before funds arrive.
    return { handled: false, profileId: null, activationEmail: "skipped" };
  }
  if (
    decision === "invalid_product" &&
    dppInvalidSettlementIsPermanent(session)
  ) {
    // The line item is already the DPP price. A discount or an unexplained
    // total will not change on Stripe's next delivery, so do not grant and
    // do not ask Stripe to retry.
    return {
      handled: true,
      profileId: null,
      activationEmail: "skipped",
      refused: "ineligible_settlement",
    };
  }
  if (decision !== "paid" && decision !== "authorized_smoke") {
    throw markRetryableFulfillment(
      new Error("DPP grant blocked: unverified completion or Stripe product")
    );
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
  const demo = decision === "authorized_smoke";
  emitTrustEvent("fulfillment.started", { session_id: session.id, plan, demo });
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

  let continuityState: Awaited<ReturnType<typeof beginProvisionContinuity>>;
  try {
    continuityState = await beginProvisionContinuity(supabase, {
      sessionId: session.id,
      amountCents: session.amount_total ?? null,
      isDemo: demo,
      plan,
    });
  } catch (err) {
    throw markRetryableFulfillment(err);
  }

  // A new delivery marker must precede the entitlement grant. Otherwise a
  // crash after continuity succeeds but before the first email could not be
  // distinguished from an older already-emailed session.
  if (!demo && continuityState !== "already_succeeded") {
    try {
      await prepareDppActivation(supabase, session.id);
    } catch (err) {
      throw markRetryableFulfillment(err);
    }
  }

  if (
    continuityState === "already_succeeded" ||
    continuityState === "grant_recorded"
  ) {
    let profileId: string | null;
    try {
      // Receipt lookup must occur even when the Checkout Session has no
      // visit-id metadata (not all Payment Links supply a visit ID).
      profileId = await findGrantedProfileId(supabase, session.id);
      if (!profileId && !demo) {
        throw new Error("DPP grant recovery profile not found");
      }
      if (continuityState === "grant_recorded") {
        await finishProvisionContinuity(supabase, {
          sessionId: session.id,
          amountCents: session.amount_total ?? null,
          isDemo: demo,
          plan,
          grantAlreadyPresent: true,
          grantApplied: Boolean(profileId),
          profileId,
        });
      }
      await recordRecoveredProvisionedEvent(supabase, {
        visitId: visitId ? String(visitId) : null,
        source: md.source || "direct",
        email,
        profileId,
        sessionId: session.id,
        plan,
        demo,
        allowNoIdentityDemo: true,
      });
    } catch (err) {
      throw markRetryableFulfillment(err);
    }
    const activationEmail = await deliverActivationAfterGrant(supabase, {
      sessionId: session.id,
      profileId,
      email,
      brand,
      visitId: visitId ? String(visitId) : null,
      source: md.source || "direct",
      demo,
    });
    return {
      handled: true,
      profileId,
      activationEmail,
      alreadyFulfilled: true,
    };
  }

  const prov = await provisionPurchase(supabase, {
    email: email || null,
    userId: md.user_id || null,
    plan,
    brand,
    stripeCustomerId: toId(session.customer),
    stripeSubscriptionId: toId(session.subscription),
    sessionId: session.id,
    atomicDppSessionGrant: true,
  });

  // A resolved profile id does not mean the entitlement write succeeded.
  // Recording provisioned here would make a failed grant look done, and
  // Stripe would not retry.
  if (prov.status === "upsert_failed") {
    throw markRetryableFulfillment(
      new Error(
        `DPP provision failed: ${prov.error || "profiles upsert failed"}`
      )
    );
  }

  // A real buyer paid and there is nobody to grant to. Acknowledging that as
  // handled told Stripe to stop retrying, closed the continuity record and
  // wrote `provisioned`, so the watchdog and the stall report both saw a
  // fulfilled sale. Fail like any other ungranted payment instead: no
  // `provisioned`, Stripe keeps the event red, and once the paid stage
  // outlives its retry budget runDppExceptionsReport escalates it.
  if (prov.status === "no_identity" && !demo) {
    throw markRetryableFulfillment(
      new Error(
        `DPP provision failed: no_identity (paid session ${session.id} has no buyer email or user id)`
      )
    );
  }

  if (prov.profileId && !prov.skippedIdempotent) {
    emitTrustEvent("entitlement.granted", {
      session_id: session.id,
      profile_id: prov.profileId,
      plan,
      demo,
    });
  }

  try {
    await finishProvisionContinuity(supabase, {
      sessionId: session.id,
      amountCents: session.amount_total ?? null,
      isDemo: demo,
      plan,
      grantAlreadyPresent: prov.skippedIdempotent === true,
      grantApplied: Boolean(prov.profileId),
      profileId: prov.profileId,
    });
  } catch (err) {
    throw markRetryableFulfillment(err);
  }

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
  }

  const activationEmail = await deliverActivationAfterGrant(supabase, {
    sessionId: session.id,
    profileId: prov.profileId,
    email,
    brand,
    visitId: visitId ? String(visitId) : null,
    source: md.source || "direct",
    demo,
  });

  return { handled: true, profileId: prov.profileId, activationEmail };
}

export type ActivationEmailStatus = "sent" | "failed" | "skipped" | "held";

export type DppFulfillResult = {
  handled: boolean;
  profileId: string | null;
  /** sent=provider accepted; held=unresolved/active attempt, never auto-resend; skipped=demo, non-DPP or already accepted. */
  activationEmail: ActivationEmailStatus;
  /** This session's durable continuity record proves fulfillment already ran. */
  alreadyFulfilled?: boolean;
  /** Permanent money refusal. Stripe must stop; nothing was granted. */
  refused?: "ineligible_settlement";
};

const EMAIL_LIKE = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+/g;

/** Strip anything address-shaped from a provider error and cap its length. */
export function redactForLog(message: string | undefined | null): string {
  if (!message) return "unknown";
  return message
    .replace(EMAIL_LIKE, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 200);
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
      source: [
        "seo",
        "direct",
        "email",
        "affiliate",
        "linkedin_post",
        "reddit_post",
        "gov_engine",
      ].includes(input.source)
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
