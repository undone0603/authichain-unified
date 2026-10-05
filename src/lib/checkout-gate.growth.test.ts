/**
 * Growth-loop instrumentation on the checkout gate.
 *
 * The gate only *reports* events through deps.onEvent; delivery is the caller's
 * job. These tests pin two things that matter more than the happy path:
 * an event is never reported for a plan whose loop does not declare it, and a
 * failing sink can never affect the Stripe response.
 */
import { describe, expect, it, vi } from "vitest";
import {
  tryHandleGatedCheckout,
  type CheckoutGateEvent,
} from "./checkout-gate";

vi.mock("./checkout-protection", () => ({
  claimCheckoutAttempt: async () => ({ allowed: true }),
  recordCheckoutSession: async () => true,
}));

const HUMAN_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const ENV = { STRIPE_SECRET_KEY: "sk_live_x" };

const protection = {
  claimCheckout: vi.fn(async () => ({ allowed: true as const })),
  recordSession: vi.fn(async () => true),
};

function stripeOk() {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          url: "https://checkout.stripe.com/c/pay/cs_test_gate",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
  );
}

function post(
  path: string,
  form: Record<string, string>,
  headers: Record<string, string> = {}
) {
  return new Request(`https://authichain.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": HUMAN_UA,
      origin: "https://authichain.com",
      ...headers,
    },
    body: new URLSearchParams(form).toString(),
  });
}

function sink() {
  const seen: CheckoutGateEvent[] = [];
  return { seen, onEvent: (e: CheckoutGateEvent) => void seen.push(e) };
}

describe("checkout view events", () => {
  it("reports the loop-specific view event per plan", async () => {
    const cases: Array<[string, string, string]> = [
      ["starter", "checkout_starter_view", "starter"],
      ["dpp_readiness", "checkout_dpp_view", "dpp_readiness"],
      [
        "strainchain_passport",
        "checkout_passport_view",
        "strainchain_passport",
      ],
    ];
    for (const [planId, event, sku] of cases) {
      const s = sink();
      const fetchImpl = vi.fn();
      const res = await tryHandleGatedCheckout(
        new Request(`https://authichain.com/checkout/${planId}`, {
          headers: { "user-agent": HUMAN_UA },
        }),
        ENV,
        { fetchImpl, onEvent: s.onEvent }
      );
      expect(res!.status).toBe(200);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(s.seen).toEqual([{ event, sku, email: undefined }]);
    }
  });

  it("reports nothing for a public plan that has no growth loop", async () => {
    const s = sink();
    // creator ($99) is in PUBLIC_PLAN_IDS but is not a loop sku.
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/creator", {
        headers: { "user-agent": HUMAN_UA },
      }),
      ENV,
      { fetchImpl: vi.fn(), onEvent: s.onEvent }
    );
    expect(res!.status).toBe(200);
    expect(s.seen).toEqual([]);
  });

  it("reports nothing on HEAD", async () => {
    const s = sink();
    await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/starter", {
        method: "HEAD",
      }),
      ENV,
      { fetchImpl: vi.fn(), onEvent: s.onEvent }
    );
    expect(s.seen).toEqual([]);
  });
});

describe("checkout POST events", () => {
  it("reports email captured then session started, carrying the email", async () => {
    const s = sink();
    const fetchImpl = stripeOk();
    const res = await tryHandleGatedCheckout(
      post("/checkout/starter", { email: "buyer@brand.com" }),
      ENV,
      { fetchImpl, ...protection, onEvent: s.onEvent }
    );
    expect(res!.status).toBe(303);
    expect(s.seen.map(e => e.event)).toEqual([
      "checkout_email_captured",
      "checkout_session_started",
    ]);
    expect(s.seen.every(e => e.email === "buyer@brand.com")).toBe(true);
    expect(s.seen.every(e => e.sku === "starter")).toBe(true);
  });

  it("reports nothing for dpp_readiness, whose loop declares neither event", async () => {
    // LOOP-02 captures email as dpp_check_email_captured, and only LOOP-03
    // declares checkout_session_started.
    const s = sink();
    const res = await tryHandleGatedCheckout(
      post("/checkout/dpp_readiness", { email: "buyer@brand.com" }),
      ENV,
      { fetchImpl: stripeOk(), ...protection, onEvent: s.onEvent }
    );
    expect(res!.status).toBe(303);
    expect(s.seen).toEqual([]);
  });

  it("reports nothing when the email is rejected", async () => {
    const s = sink();
    const fetchImpl = vi.fn();
    const res = await tryHandleGatedCheckout(
      post("/checkout/starter", { email: "nope" }),
      ENV,
      { fetchImpl, onEvent: s.onEvent }
    );
    expect(res!.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(s.seen).toEqual([]);
  });

  it("reports nothing for an automated request", async () => {
    const s = sink();
    const res = await tryHandleGatedCheckout(
      post(
        "/checkout/starter",
        { email: "buyer@brand.com" },
        { "user-agent": "curl/8.4.0" }
      ),
      ENV,
      { fetchImpl: vi.fn(), onEvent: s.onEvent }
    );
    expect(res!.status).toBe(403);
    expect(s.seen).toEqual([]);
  });

  it("reports no session_started when Stripe fails", async () => {
    const s = sink();
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    const res = await tryHandleGatedCheckout(
      post("/checkout/starter", { email: "buyer@brand.com" }),
      ENV,
      { fetchImpl, ...protection, onEvent: s.onEvent }
    );
    expect(res!.status).toBe(502);
    expect(s.seen.map(e => e.event)).toEqual(["checkout_email_captured"]);
  });
});

describe("analytics can never break checkout", () => {
  it("still 303s to Stripe when the sink throws", async () => {
    const res = await tryHandleGatedCheckout(
      post("/checkout/starter", { email: "buyer@brand.com" }),
      ENV,
      {
        fetchImpl: stripeOk(),
        ...protection,
        onEvent: () => {
          throw new Error("sink exploded");
        },
      }
    );
    expect(res!.status).toBe(303);
    expect(res!.headers.get("location")).toContain("checkout.stripe.com");
  });

  it("works with no sink at all", async () => {
    const res = await tryHandleGatedCheckout(
      post("/checkout/starter", { email: "buyer@brand.com" }),
      ENV,
      { fetchImpl: stripeOk(), ...protection }
    );
    expect(res!.status).toBe(303);
  });
});
