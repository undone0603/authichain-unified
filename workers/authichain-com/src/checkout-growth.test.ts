/**
 * The landing worker sink for checkout measurement.
 *
 * Growth events go through the existing RPC. A DPP checkout_started row is
 * posted to /api/funnel only after the gate has a Stripe URL, and only for
 * dpp_readiness. A failed write must not throw into checkout.
 */
import { describe, expect, it, vi } from "vitest";
import {
  deliverCheckoutGateEvent,
  deliverDppCheckoutStarted,
} from "./checkout-growth";

vi.mock("../../../worker-app/growth-record", () => ({
  recordGrowthEvent: vi.fn(async () => undefined),
}));

import { recordGrowthEvent } from "../../../worker-app/growth-record";

function waiter() {
  const tasks: Promise<unknown>[] = [];
  return {
    tasks,
    waitUntil(promise: Promise<unknown>) {
      tasks.push(promise);
    },
    flush: () => Promise.all(tasks),
  };
}

function appWorker(status = 200, body = "{}") {
  const fetch = vi.fn(async () => new Response(body, { status }));
  return { fetch };
}

describe("deliverDppCheckoutStarted", () => {
  it("posts checkout_started only for a DPP session with a visit id", async () => {
    const ctx = waiter();
    const worker = appWorker();
    deliverDppCheckoutStarted(
      { APP_WORKER: worker },
      ctx,
      { planId: "dpp_readiness", visitId: "v_dpp", source: "email" }
    );
    await ctx.flush();
    expect(worker.fetch).toHaveBeenCalledOnce();
    const req = worker.fetch.mock.calls[0]![0] as Request;
    expect(req.url).toBe("https://authichain.com/api/funnel");
    expect(req.method).toBe("POST");
    expect(await req.json()).toEqual({
      prospect_id: "v_dpp",
      stage: "checkout_started",
      source: "email",
      event_type: "dpp_loop:checkout_started",
      metadata: { loop_stage: "checkout_started", plan: "dpp_readiness" },
    });
  });

  it("does not post for another plan, a missing visit, or an unbound worker", async () => {
    const ctx = waiter();
    const worker = appWorker();
    deliverDppCheckoutStarted(
      { APP_WORKER: worker },
      ctx,
      { planId: "starter", visitId: "v_1", source: "direct" }
    );
    deliverDppCheckoutStarted(
      { APP_WORKER: worker },
      ctx,
      { planId: "dpp_readiness", visitId: "", source: "direct" }
    );
    deliverDppCheckoutStarted(
      {},
      ctx,
      { planId: "dpp_readiness", visitId: "v_dpp", source: "direct" }
    );
    await ctx.flush();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it("coerces a sales utm_source that the funnel enum does not list", async () => {
    const ctx = waiter();
    const worker = appWorker();
    deliverDppCheckoutStarted(
      { APP_WORKER: worker },
      ctx,
      { planId: "dpp_readiness", visitId: "v_dpp", source: "authichain" }
    );
    await ctx.flush();
    const req = worker.fetch.mock.calls[0]![0] as Request;
    const body = (await req.json()) as { source: string };
    expect(body.source).toBe("direct");
  });

  it("keeps a non-OK funnel write off the checkout response", async () => {
    const ctx = waiter();
    const worker = appWorker(500, "store down");
    expect(() =>
      deliverDppCheckoutStarted(
        { APP_WORKER: worker },
        ctx,
        { planId: "dpp_readiness", visitId: "v_dpp", source: "direct" }
      )
    ).not.toThrow();
    await expect(ctx.flush()).resolves.toBeDefined();
  });

  it("drops the wait when waitUntil throws", () => {
    const worker = appWorker();
    expect(() =>
      deliverDppCheckoutStarted(
        { APP_WORKER: worker },
        {
          waitUntil() {
            throw new Error("no execution context");
          },
        },
        { planId: "dpp_readiness", visitId: "v_dpp", source: "direct" }
      )
    ).not.toThrow();
  });
});

describe("deliverCheckoutGateEvent", () => {
  it("hands a declared event to the growth recorder", async () => {
    const ctx = waiter();
    deliverCheckoutGateEvent(
      { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" },
      ctx,
      { event: "checkout_dpp_view", sku: "dpp_readiness" }
    );
    await ctx.flush();
    expect(recordGrowthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ SUPABASE_URL: "https://example.supabase.co" }),
      { event: "checkout_dpp_view", sku: "dpp_readiness", email: undefined }
    );
  });
});
