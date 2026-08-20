import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, { type Env, verifyStripeSignature } from "./worker";

const secret = "whsec_test_secret";
const body = '{"id":"evt_test","type":"checkout.session.completed"}';

function signature(timestamp: number, payload = body): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("verifyStripeSignature", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T00:00:00.000Z"));
  });

  it("accepts a Stripe v1 signature for the exact raw payload", async () => {
    const timestamp = Math.floor(Date.now() / 1000);

    await expect(
      verifyStripeSignature(body, signature(timestamp), secret)
    ).resolves.toBe(true);
  });

  it("rejects a signature when the raw payload was changed", async () => {
    const timestamp = Math.floor(Date.now() / 1000);

    await expect(
      verifyStripeSignature(`${body} `, signature(timestamp), secret)
    ).resolves.toBe(false);
  });

  it("rejects stale signatures", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 301;

    await expect(
      verifyStripeSignature(body, signature(timestamp), secret)
    ).resolves.toBe(false);
  });

  it("rejects unsigned webhook requests before handling event data", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.test/stripe/webhook", {
        method: "POST",
        body,
      }),
      { STRIPE_WEBHOOK_SECRET: secret } as Env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid Stripe signature",
    });
  });
});
