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
import { dppActivateUrl, recordDppLoopEventOnce } from "./dpp-loop";
import {
  beginProvisionContinuity,
  finishProvisionContinuity,
  provisionContinuityProfileId,
} from "./founder-exit/supabase-log";
import { markRetryableFulfillment } from "./retryable-fulfillment";
import {
  dppGrantDecision,
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
 * Activation delivery uses a different durable claim from the entitlement grant.
 * A sending/unknown claim must be reconciled, never blindly resent: the provider
 * could have accepted the email before the webhook crashed.
 */
async function sendActivationEmailOnce(
  supabase: SupabaseLike,
  input: {
    sessionId: string;
    profileId: string | null;
    email: string;
    brand: string;
    visitId: string | null;
    source: string;
    demo: boolean;
  }
): Promise<ActivationEmailStatus> {
  if (input.demo || !input.email || !input.profileId) return "skipped";
  const deliveryDb = supabase as SupabaseLike & {
    rpc?: (
      name: string,
      args: Record<string, string>
    ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  };
  if (!deliveryDb.rpc) {
    throw markRetryableFulfillment(new Error("DPP activation delivery RPC unavailable"));
  }
  const claimToken = crypto.randomUUID();
  const claimed = await deliveryDb.rpc("claim_dpp_activation_email", {
    p_session_id: input.sessionId,
    p_profile_id: input.profileId,
    p_claim_token: claimToken,
  });
  if (claimed.error) throw markRetryableFulfillment(new Error("DPP activation claim failed"));
  if (claimed.data === "sent") return "skipped";
  if (claimed.data === "reconcile") {
    throw markRetryableFulfillment(new Error("DPP activation delivery requires reconciliation"));
  }
  if (claimed.data !== "claimed") {
    throw markRetryableFulfillment(new Error("DPP activation claim returned unexpected state"));
  }

  const mail = renderBillingEmail("dpp_audit_provisioned", input.brand, {
    planName: "EU DPP Workspace",
    activateUrl: dppActivateUrl(input.sessionId, input.visitId),
  });
  let result: {
    ok: boolean;
    provider?: string;
    status?: number;
    error?: string;
  };
  let ambiguous = false;
  try {
    result = await sendEmail({
      to: input.email,
      from: mail.from,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  } catch (err) {
    ambiguous = true;
    result = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const outcome = result.ok ? "sent" : ambiguous ? "unknown" : "failed";
  const finished = await deliveryDb.rpc("finish_dpp_activation_email", {
    p_session_id: input.sessionId,
    p_claim_token: claimToken,
    p_outcome: outcome,
  });
  if (finished.error || finished.data !== true) {
    // Do not re-send if a successful provider response could not be recorded.
    throw markRetryableFulfillment(new Error("DPP activation delivery result not persisted"));
  }
  if (result.ok) return "sent";

  const reason = redactForLog(result.error ?? "no send result");
  console.error(
    `[dpp-fulfill] activation email failed: session=${input.sessionId} profile=${input.profileId} provider=${result.provider ?? "unknown"} status=${result.status ?? "n/a"} reason=${reason}`
  );
  await recordActivationEmailFailed(supabase, {
    prospectId: input.visitId ?? input.sessionId,
    source: input.source,
    stripeSessionId: input.sessionId,
    profileId: input.profileId,
    provider: result.provider ?? null,
    httpStatus: result.status ?? null,
    reason,
  });
  if (ambiguous) {
    throw markRetryableFulfillment(new Error("DPP activation delivery outcome unknown"));
  }
  return "failed";
}

export async function fulfillDppPaidSession(
  supabase: SupabaseLike,
  session: DppCheckoutSessionLike,
  priceId?: string | null
): Promise<DppFulfillResult> {
  try {
    const result = await fulfillDppPaidSessionOnce(supabase, session, priceId);
    if (result.handled) {
      emitTrustEvent("fulfillment.completed", {
        session_id: session.id,
        profile_id: result.profileId,
        plan: session.metadata?.plan || "dpp_readiness",
        outcome: result.alreadyFulfilled
          ? "already_fulfilled"
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

  if (continuityState === "already_succeeded") {
    let profileId: string | null = null;
    try {
      if (visitId || (!demo && email)) {
        profileId = await findGrantedProfileId(supabase, session.id);
      }
      if (visitId) {
        await recordRecoveredProvisionedEvent(supabase, {
          visitId: String(visitId),
          source: md.source || "direct",
          email,
          profileId,
          sessionId: session.id,
          plan,
          demo,
          allowNoIdentityDemo: true,
        });
      }
    } catch (err) {
      throw markRetryableFulfillment(err);
    }
    const activationEmail = await sendActivationEmailOnce(supabase, {
      sessionId: session.id,
      profileId,
      email,
      brand,
      visitId: visitId ? String(visitId) : null,
      source: md.source || "direct",
      demo,
    });
    return { handled: true, profileId, activationEmail, alreadyFulfilled: true };
  }
  if (continuityState === "grant_recorded") {
    let profileId: string | null;
    try {
      profileId = await findGrantedProfileId(supabase, session.id);
      if (!profileId) throw new Error("DPP grant recovery profile not found");
      await finishProvisionContinuity(supabase, {
        sessionId: session.id,
        amountCents: session.amount_total ?? null,
        isDemo: demo,
        plan,
        grantAlreadyPresent: true,
        grantApplied: true,
        profileId,
      });
      await recordRecoveredProvisionedEvent(supabase, {
        visitId: visitId ? String(visitId) : null,
        source: md.source || "direct",
        email,
        profileId,
        sessionId: session.id,
        plan,
        demo,
      });
    } catch (err) {
      throw markRetryableFulfillment(err);
    }
    const activationEmail = await sendActivationEmailOnce(supabase, {
      sessionId: session.id,
      profileId,
      email,
      brand,
      visitId: visitId ? String(visitId) : null,
      source: md.source || "direct",
      demo,
    });
    return { handled: true, profileId, activationEmail, alreadyFulfilled: true };
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

  const activationEmail = await sendActivationEmailOnce(supabase, {
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

export type ActivationEmailStatus = "sent" | "failed" | "skipped";

export type DppFulfillResult = {
  handled: boolean;
  profileId: string | null;
  /** Outcome of the activation email: skipped = not attempted (no email, demo, or not a DPP grant). */
  activationEmail: ActivationEmailStatus;
  /** This session's durable continuity record proves fulfillment already ran. */
  alreadyFulfilled?: boolean;
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
