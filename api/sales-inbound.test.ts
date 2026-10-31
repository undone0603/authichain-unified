// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

import {
  cleanText,
  handleSalesInbound,
  LIMITS,
  SALES_MODEL,
  sellablePlan,
  type SalesInboundEnv,
} from "./sales-inbound";
import worker, { type Env } from "./worker";
import { planById } from "../src/lib/plans";

const SECRET = "sales-secret";
const lead = {
  name: "Jane Doe",
  email: "Jane@Example.com",
  intent:
    "Looking to integrate QRON anti-counterfeiting for my upcoming 5,000 unit apparel drop.",
  plan_id: "dpp_readiness",
};

const limiter = { limit: vi.fn(async () => ({ success: true })) };
const env = {
  SALES_INBOUND_SECRET: SECRET,
  SALES_RATE_LIMITER: limiter,
  ANTHROPIC_API_KEY: "test-key",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  NEXT_PUBLIC_APP_URL: "https://app.example.test",
} as unknown as Env;

describe("sales-inbound worker route", () => {
  beforeEach(() => {
    create.mockReset();
    vi.unstubAllGlobals();
  });

  it("rejects unauthorized secret", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/sales/inbound", {
        method: "POST",
        headers: { "x-sales-inbound-secret": "wrong-secret" },
      }),
      env
    );

    expect(res.status).toBe(401);
  });

  it("handles valid inbound request and formats response", async () => {
    const stripeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ url: "https://checkout.stripe.test/s" }), {
          status: 200,
        })
    );
    vi.stubGlobal("fetch", stripeFetch);
    create.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Hi Jane, DPP readiness fits your 5k drop." }],
    });

    const res = await worker.fetch(
      new Request("http://localhost/sales/inbound", {
        method: "POST",
        headers: {
          "x-sales-inbound-secret": SECRET,
          "content-type": "application/json",
        },
        body: JSON.stringify(lead),
      }),
      env
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.lead).toBe("jane@example.com");
    expect(json.plan_id).toBe("dpp_readiness");
    expect(json.checkoutUrl).toBe("https://checkout.stripe.test/s");
    expect(json.replySource).toBe("claude");
    expect(json.aiResponse).toContain("DPP readiness");
    expect(stripeFetch).toHaveBeenCalledTimes(1);
  });
});
