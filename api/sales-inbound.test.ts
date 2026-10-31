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

function env(over: Partial<SalesInboundEnv> = {}): SalesInboundEnv {
  return {
    STRIPE_SECRET_KEY: "sk_test_x",
    SALES_INBOUND_SECRET: SECRET,
    NEXT_PUBLIC_APP_URL: "https://authichain.com",
    SALES_RATE_LIMITER: limiter(),
    ...over,
  };
}

function stripeOk() {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }),
        {
          status: 200,
        }
      )
  );
}

function req(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "cf-connecting-ip": "203.0.113.7",
  };
  if (secret !== null) headers["x-sales-inbound-secret"] = secret;
  return new Request("https://worker.test/sales/inbound", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => create.mockReset());

describe("sales inbound: guards", () => {
  it("refuses everything when the secret or the rate limiter is not configured", async () => {
    const fetch = stripeOk();
    for (const e of [
      env({ SALES_INBOUND_SECRET: "" }),
      env({ SALES_RATE_LIMITER: undefined }),
    ]) {
      const res = await handleSalesInbound(req(lead), e, { fetch });
      expect(res.status).toBe(503);
    }
    expect(fetch).not.toHaveBeenCalled();
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
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const form = new URLSearchParams(init.body as string);
    expect(form.get("line_items[0][price]")).toBe(
      planById("dpp_readiness")?.stripe_price_id
    );
    expect(form.get("mode")).toBe("payment");
    expect(form.get("customer_email")).toBe("jane@example.com");
    // What the app webhook needs to fulfil and provision the purchase.
    expect(form.get("metadata[plan]")).toBe("dpp_readiness");
    expect(form.get("metadata[stripe_price_id]")).toBe(
      planById("dpp_readiness")?.stripe_price_id
    );
    const sent = String(init.body);
    expect(sent).not.toMatch(/unit_amount|price_data|product_data/);
    expect(sent).not.toContain("iPhone");
  });
});

describe("sales inbound: validation and outcomes", () => {
  it("rejects bad JSON, a bad email, and empty name or intent", async () => {
    const fetch = stripeOk();
    for (const body of [
      "not json",
      "[1]",
      { ...lead, email: "nope" },
      { ...lead, name: " \u0000 " },
      { ...lead, intent: "" },
    ]) {
      const res = await handleSalesInbound(req(body), env(), { fetch });
      expect(res.status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the checkout link and the model's reply", async () => {
    const writeReply = vi.fn(
      async () => "Hi Jane, DPP Readiness fits your drop."
    );
    const res = await handleSalesInbound(req(lead), env(), {
      fetch: stripeOk(),
      writeReply,
    });
    expect(await res.json()).toEqual({
      success: true,
      lead: "jane@example.com",
      plan_id: "dpp_readiness",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_1",
      aiResponse: "Hi Jane, DPP Readiness fits your drop.",
      replySource: "writer",
    });
    expect(writeReply).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane Doe", intent: lead.intent })
    );
  });

  it("returns 502 without calling Claude when Stripe fails", async () => {
    const writeReply = vi.fn();
    const fetch = vi.fn(async () => new Response("{}", { status: 500 }));
    const res = await handleSalesInbound(req(lead), env(), {
      fetch,
      writeReply,
    });
    expect(res.status).toBe(502);
    expect(writeReply).not.toHaveBeenCalled();
  });

  it("still sells with a fixed reply when Claude fails", async () => {
    const res = await handleSalesInbound(req(lead), env(), {
      fetch: stripeOk(),
      writeReply: async () => {
        throw new Error("overloaded");
      },
    });
    const body = (await res.json()) as Record<string, string>;
    expect(res.status).toBe(200);
    expect(body.replySource).toBe("template");
    expect(body.aiResponse).toContain("EU DPP Workspace ($299)");
    expect(body.aiResponse).not.toContain("EU DPP Readiness Audit");
  });

  it("strips control characters and caps lengths", () => {
    expect(cleanText("a\u0000b\u202Ec\n\n\n\nd", 100)).toBe("a b c\n\nd");
    expect(cleanText("x".repeat(5000), LIMITS.intent)).toHaveLength(
      LIMITS.intent
    );
    expect(cleanText(42, 10)).toBe("");
  });
});

describe("sales inbound: no paid model calls", () => {
  it("never constructs the Anthropic client and replies from the template", async () => {
    const fetch = stripeOk();
    const res = await handleSalesInbound(req(lead), env(), { fetch });
    expect(((await res.json()) as Record<string, string>).replySource).toBe(
      "template"
    );
    expect(create).not.toHaveBeenCalled();
    for (const c of fetch.mock.calls)
      expect(String(c[0])).toMatch(/^https:\/\/api\.stripe\.com\//);
  });
});

describe("revenue worker routing", () => {
  it("mounts /sales/inbound behind its own secret, not WORKER_API_KEY", async () => {
    const e = { WORKER_API_KEY: "k" } as unknown as Env;
    const res = await worker.fetch(req(lead), e);
    expect(res.status).toBe(503);

    const other = await worker.fetch(
      new Request("https://worker.test/seal", { method: "POST" }),
      e
    );
    expect(other.status).toBe(401);
  });
});
