/**
 * Real Stripe SDK tests for Workers-safe webhook verification.
 * The handler mock in server/webhooks/stripe.test.ts cannot catch a
 * SubtleCryptoProvider regression; this file uses stripe-node itself.
 */
import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import {
  constructStripeEventAsync,
  normalizeWebhookSecrets,
  webhookPayloadUtf8,
} from "./stripe-construct-event";

const API_VERSION = "2026-08-26.dahlia" as const;

function signedPayload(secret: string, id = "evt_test_async") {
  const payload = JSON.stringify({
    id,
    object: "event",
    api_version: API_VERSION,
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_async",
        object: "checkout.session",
        payment_status: "paid",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  });
  const stripe = new Stripe("sk_test_construct_event", {
    apiVersion: API_VERSION,
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return { stripe, payload, signature };
}

describe("constructStripeEventAsync", () => {
  it("verifies a Dashboard-shaped signature with constructEventAsync", async () => {
    const secret = "whsec_test_async_ok";
    const { stripe, payload, signature } = signedPayload(secret);
    const event = await constructStripeEventAsync(stripe, payload, signature, [
      secret,
    ]);
    expect(event.id).toBe("evt_test_async");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("tries the next secret when the first candidate does not match", async () => {
    const secret = "whsec_second_candidate";
    const { stripe, payload, signature } = signedPayload(
      secret,
      "evt_test_second"
    );
    const event = await constructStripeEventAsync(stripe, payload, signature, [
      "whsec_wrong",
      secret,
    ]);
    expect(event.id).toBe("evt_test_second");
  });

  it("throws when no candidate secret verifies", async () => {
    const { stripe, payload, signature } = signedPayload("whsec_real");
    await expect(
      constructStripeEventAsync(stripe, payload, signature, ["whsec_other"])
    ).rejects.toThrow(/No signatures found matching the expected signature/);
  });

  it("throws when the secrets list is empty", async () => {
    const { stripe, payload, signature } = signedPayload("whsec_real");
    await expect(
      constructStripeEventAsync(stripe, payload, signature, [])
    ).rejects.toThrow(/STRIPE_WEBHOOK_SECRET not configured/);
  });

  it("trims a trailing newline from echo | wrangler secret put", async () => {
    const secret = "whsec_trim_newline";
    const { stripe, payload, signature } = signedPayload(
      secret,
      "evt_test_trim"
    );
    const event = await constructStripeEventAsync(stripe, payload, signature, [
      `${secret}\n`,
    ]);
    expect(event.id).toBe("evt_test_trim");
  });

  it("verifies a Buffer payload without re-encoding JSON", async () => {
    const secret = "whsec_buffer_payload";
    const { stripe, payload, signature } = signedPayload(
      secret,
      "evt_test_buffer"
    );
    const event = await constructStripeEventAsync(
      stripe,
      Buffer.from(payload, "utf8"),
      signature,
      [secret]
    );
    expect(event.id).toBe("evt_test_buffer");
  });
});

describe("normalizeWebhookSecrets / webhookPayloadUtf8", () => {
  it("drops blank and duplicate secrets after trim", () => {
    expect(
      normalizeWebhookSecrets(["  whsec_a\n", "", "whsec_a", "whsec_b"])
    ).toEqual(["whsec_a", "whsec_b"]);
  });

  it("keeps UTF-8 JSON bytes identical to the string Stripe signed", () => {
    const json = '{"id":"evt_utf8","object":"event"}';
    expect(webhookPayloadUtf8(Buffer.from(json, "utf8"))).toBe(json);
  });
});

describe("SubtleCryptoProvider (Workers/edge)", () => {
  it("sync constructEvent throws the live 400; constructEventAsync verifies", async () => {
    const secret = "whsec_subtle";
    const { stripe, payload, signature } = signedPayload(
      secret,
      "evt_subtle_crypto"
    );
    const provider = Stripe.createSubtleCryptoProvider();

    expect(() =>
      stripe.webhooks.constructEvent(
        payload,
        signature,
        secret,
        undefined,
        provider
      )
    ).toThrow(/SubtleCryptoProvider cannot be used in a synchronous context/);

    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      secret,
      undefined,
      provider
    );
    expect(event.id).toBe("evt_subtle_crypto");
    expect(event.type).toBe("checkout.session.completed");
  });
});
