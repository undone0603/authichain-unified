/**
 * Autonomous DPP revenue-loop event recording.
 *
 * Maps loop stages onto existing funnel_events enum values and stores the
 * canonical loop stage in metadata.loop_stage so smoke/reporting can reconstruct
 * attributed_visit → … → retained without a schema migration.
 */

import { DPP_OFFER_KEY } from "./plans";

export type DppLoopStage =
  | "attributed_visit"
  | "checkout_started"
  | "payment_succeeded"
  | "provisioned"
  | "merchant_activated"
  | "dpp_published"
  | "verification"
  | "retained";

type FunnelStage =
  "visit_landing_page" | "start_checkout" | "complete_checkout" | "subscribe";

const STAGE_TO_FUNNEL: Record<DppLoopStage, FunnelStage> = {
  attributed_visit: "visit_landing_page",
  checkout_started: "start_checkout",
  payment_succeeded: "complete_checkout",
  provisioned: "complete_checkout",
  merchant_activated: "subscribe",
  dpp_published: "subscribe",
  verification: "subscribe",
  retained: "subscribe",
};

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export interface RecordDppLoopEventInput {
  visitId: string;
  stage: DppLoopStage;
  source?: string;
  email?: string | null;
  profileId?: string | null;
  stripeSessionId?: string | null;
  metadata?: Record<string, unknown>;
}

function normalizeSource(
  source: string | undefined
):
  | "seo"
  | "direct"
  | "email"
  | "affiliate"
  | "linkedin_post"
  | "reddit_post"
  | "gov_engine" {
  const allowed = new Set([
    "gov_engine",
    "linkedin_post",
    "reddit_post",
    "seo",
    "direct",
    "email",
    "affiliate",
  ]);
  if (source && allowed.has(source)) {
    return source as
      | "seo"
      | "direct"
      | "email"
      | "affiliate"
      | "linkedin_post"
      | "reddit_post"
      | "gov_engine";
  }
  return "direct";
}

/** Persist one observable loop stage. Never throws — logging only on failure. */
export async function recordDppLoopEvent(
  supabase: SupabaseLike,
  input: RecordDppLoopEventInput
): Promise<void> {
  const visitId = input.visitId?.trim();
  if (!visitId) return;

  try {
    await supabase.from("funnel_events").insert({
      prospect_id: visitId,
      stage: STAGE_TO_FUNNEL[input.stage],
      source: normalizeSource(input.source),
      event_type: `dpp_loop:${input.stage}`,
      metadata: {
        offer: DPP_OFFER_KEY,
        loop_stage: input.stage,
        ...(input.email ? { email: input.email } : {}),
        ...(input.profileId ? { profile_id: input.profileId } : {}),
        ...(input.stripeSessionId
          ? { stripe_session_id: input.stripeSessionId }
          : {}),
        ...(input.metadata || {}),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[dpp-loop] record failed:", input.stage, err);
  }
}

/** Live Stripe price for EU DPP Readiness Audit ($299). */
export const DPP_PRICE_ID = "price_1TwmD8GqTruSqV8TpAF8dfyA";

export function isDppOffer(
  metadata: Record<string, unknown> | null | undefined,
  priceId?: string | null
): boolean {
  const offer = String(metadata?.offer || metadata?.offer_key || "");
  const plan = String(metadata?.plan || "");
  if (offer === DPP_OFFER_KEY || plan === "dpp_readiness") return true;
  if (priceId && priceId === DPP_PRICE_ID) return true;
  return false;
}

export function dppActivateUrl(
  sessionId: string,
  visitId?: string | null
): string {
  const base = "https://authichain.com/dpp/activate";
  const params = new URLSearchParams({ session_id: sessionId });
  if (visitId) params.set("visit_id", visitId);
  return `${base}?${params.toString()}`;
}
