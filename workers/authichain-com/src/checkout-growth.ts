/**
 * Deliver checkout-gate events on the landing worker.
 *
 * The gate only reports. This file is the sink: declared growth events go
 * through growth_record_event, and a paid-path DPP session records
 * dpp_loop:checkout_started on the existing /api/funnel route. Neither write
 * is awaited on the request that creates the Stripe session.
 */
import type { CheckoutGateEvent } from "../../../src/lib/checkout-gate";
import { FUNNEL_SOURCES } from "../../../src/lib/funnel-record";
import { recordGrowthEvent } from "../../../worker-app/growth-record";

export type CheckoutGrowthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_WORKER?: { fetch: (request: Request) => Promise<Response> };
};

type WaitCtx = { waitUntil?: (promise: Promise<unknown>) => void };

function keep(ctx: WaitCtx | undefined, task: Promise<unknown>): void {
  const guarded = task.catch((err: unknown) => {
    console.error(
      "[checkout-growth] record failed:",
      err instanceof Error ? err.message : err
    );
  });
  try {
    ctx?.waitUntil?.(guarded);
  } catch {
    /* The response is already finishing. Drop the wait, not the checkout. */
  }
}

export function deliverCheckoutGateEvent(
  env: CheckoutGrowthEnv,
  ctx: WaitCtx | undefined,
  event: CheckoutGateEvent
): void {
  keep(
    ctx,
    recordGrowthEvent(env, {
      event: event.event,
      sku: event.sku,
      email: event.email,
    })
  );
}

export function deliverDppCheckoutStarted(
  env: CheckoutGrowthEnv,
  ctx: WaitCtx | undefined,
  info: { planId: string; visitId: string; source: string }
): void {
  if (info.planId !== "dpp_readiness" || !info.visitId || !env.APP_WORKER) return;
  const source = (FUNNEL_SOURCES as readonly string[]).includes(info.source)
    ? info.source
    : "direct";
  keep(
    ctx,
    env.APP_WORKER.fetch(
      new Request("https://authichain.com/api/funnel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prospect_id: info.visitId,
          stage: "checkout_started",
          source,
          event_type: "dpp_loop:checkout_started",
          metadata: {
            loop_stage: "checkout_started",
            plan: info.planId,
          },
        }),
      })
    ).then(async (res) => {
      if (!res.ok) {
        console.error(
          `[funnel] checkout_started not recorded: ${res.status} ${await res.text()}`
        );
      }
    })
  );
}
