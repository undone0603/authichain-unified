import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// Relative, not "@/…": tsconfig.worker.json has no @/ alias for server/.
import { getStripe } from "../../../server/config/stripe";

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

type AutomationLogWriter = {
  insert: (values: Record<string, unknown>) => PromiseLike<unknown>;
};

function automationLogs(): AutomationLogWriter {
  return getAdmin().from("automation_logs") as unknown as AutomationLogWriter;
}

/**
 * Meter units per AI agent tool call. The price of a unit is whatever metered
 * price the owner attaches to the Stripe Meter; nothing here sets it.
 */
export const METERED_PRICING = {
  verify_product: 1,
  register_product: 10,
  check_eu_dpp: 100,
  mint_certificate: 20,
};

export type MeteredTool = keyof typeof METERED_PRICING;

const ENTITLED_STATUSES = new Set(["active", "trialing"]);

/**
 * The Stripe Billing Meter event name for agent tool calls, from
 * STRIPE_AGENT_METER_EVENT. Unset means metering is off and nothing is sent
 * to Stripe. Set it only after the Meter exists and a metered price on the
 * customer's subscription is attached to it; until then Stripe rejects the
 * event and the call is logged as a failure.
 */
export function agentMeterEventName(): string | null {
  const name = process.env.STRIPE_AGENT_METER_EVENT?.trim();
  return name ? name : null;
}

/**
 * Report one agent tool call to Stripe as a Billing Meter event.
 *
 * Replaces subscriptionItems.createUsageRecord, which the current Stripe SDK
 * does not have: every call threw, was caught and logged, and nothing was
 * ever billed. Same meterEvents call as server/tenant-billing.ts.
 *
 * Bills only an entitled customer (profiles.subscription_status active or
 * trialing, with a stripe_customer_id). Never throws: usage reporting must
 * not fail the tool call.
 */
export async function reportAgentUsage(
  userId: string,
  toolName: MeteredTool
): Promise<void> {
  const eventName = agentMeterEventName();
  if (!eventName) return;

  try {
    const { data: profileRow, error } = await getAdmin()
      .from("profiles")
      .select("stripe_customer_id, subscription_status")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const profile = profileRow as {
      stripe_customer_id: string | null;
      subscription_status: string | null;
    } | null;

    if (
      !profile?.stripe_customer_id ||
      !ENTITLED_STATUSES.has(profile.subscription_status ?? "")
    ) {
      console.warn(
        `[Billing] No entitled Stripe customer for ${userId}; ${toolName} not metered`
      );
      return;
    }

    const quantity = METERED_PRICING[toolName];
    // Stripe dedupes meter events by identifier, so a retried request
    // cannot bill the same call twice.
    const identifier = globalThis.crypto.randomUUID();
    await getStripe().billing.meterEvents.create({
      event_name: eventName,
      identifier,
      payload: {
        stripe_customer_id: profile.stripe_customer_id,
        value: String(quantity),
      },
    });

    await automationLogs().insert({
      workflow_name: "metered_usage_reported",
      trigger_type: "event",
      status: "success",
      payload: JSON.stringify({
        userId,
        toolName,
        quantity,
        eventName,
        identifier,
      }),
    });
  } catch (err) {
    console.error("[Billing] Reporting failed:", err);
    // Non-blocking log
    automationLogs()
      .insert({
        workflow_name: "metered_usage_reported",
        trigger_type: "event",
        status: "failure",
        error_message: err instanceof Error ? err.message : String(err),
      })
      .then(undefined, (logErr: unknown) => {
        console.error("[Billing] Failed to write failure log:", logErr);
      });
  }
}
