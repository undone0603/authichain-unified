import { describe, expect, it, vi } from "vitest";
import {
  BUY_HEADING,
  COFFEE_PAYMENT_LINK_URL,
  COFFEE_PRESETS,
  COFFEE_PRICE_ID,
  COFFEE_PRODUCT_ID,
  COFFEE_PROMISES,
  COFFEE_UNIT_CENTS,
  HANDLE_MAX,
  MAX_SUPPORT_CENTS,
  MESSAGE_MAX,
  MIN_SUPPORT_CENTS,
  NON_TAX_DEDUCTIBLE_DISCLOSURE,
  RECEIPT_TYPE,
  SAMPLE_COFFEE_JWKS,
  SAMPLE_COFFEE_KID,
  SUPPORT_KIND,
  SUPPORT_SKU,
  THANKS_COPY,
  buildStripeCheckoutPayload,
  buildX402SupportChallenge,
  centsToUsdcAtomic,
  coffeeCheckoutResponse,
  createCoffeeCheckoutSession,
  generateSupportReceiptKeypair,
  isCoffeePaidSession,
  mintProofOfCoffeeReceipt,
  negotiateSupportRail,
  parseCoffeeThanksCookie,
  parseCoffeeThanksFlag,
  resolveCoffeePageMode,
  resolveSupportAmount,
  retrieveCoffeeCheckoutSession,
  sanitizeSupporterFields,
  serializeCoffeeThanksCookie,
  stripUrls,
  verifyProofOfCoffeeReceipt,
} from "./support-coffee";
import { X402_PUBLISHED_PAY_TO } from "./x402";

describe("constants & compliance", () => {
  it("uses $5 coffee unit and 1/3/5 presets", () => {
    expect(COFFEE_UNIT_CENTS).toBe(500);
    expect([...COFFEE_PRESETS]).toEqual([1, 3, 5]);
  });

  it("enforces $3 min and $500 max", () => {
    expect(MIN_SUPPORT_CENTS).toBe(300);
    expect(MAX_SUPPORT_CENTS).toBe(50000);
  });

  it("wires the live Stripe product, price, and Payment Link", () => {
    expect(COFFEE_PRODUCT_ID).toBe("prod_VZzV7sMrcp0RPu");
    expect(COFFEE_PRICE_ID).toBe("price_1UYpWwGqTruSqV8Te1I5kliJ");
    expect(COFFEE_PAYMENT_LINK_URL).toBe(
      "https://buy.stripe.com/8x24gz4Vb6BgdOGePO1NE09"
    );
  });

  it("disclosure is commercial tip, not charity / not deductible", () => {
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).toMatch(/not a charitable donation/i);
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).toMatch(/not tax-deductible/i);
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).toMatch(/sole proprietor/i);
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).not.toMatch(/501\(c\)\(3\)/);
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).not.toMatch(/AuthiChain, Inc\./);
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).not.toMatch(
      /50 workspace generations/
    );
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).not.toMatch(/never expire/);
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).not.toMatch(/qron_launch/);
    expect(NON_TAX_DEDUCTIBLE_DISCLOSURE).not.toMatch(/strainchain_farm/);
  });

  it("hard-codes zero promises", () => {
    expect(COFFEE_PROMISES).toEqual({
      equity: false,
      tokens: false,
      sla: false,
      productEntitlement: false,
      taxDeductible: false,
      charity: false,
    });
  });
});

describe("resolveSupportAmount", () => {
  it("resolves 1× / 3× / 5× presets", () => {
    expect(resolveSupportAmount({ units: 1 })).toEqual({
      ok: true,
      cents: 500,
      units: 1,
      label: "1× coffee ($5.00)",
    });
    expect(resolveSupportAmount({ units: 3 })).toMatchObject({ cents: 1500 });
    expect(resolveSupportAmount({ units: 5 })).toMatchObject({ cents: 2500 });
  });

  it("rejects invalid units", () => {
    expect(resolveSupportAmount({ units: 2 }).ok).toBe(false);
    expect(resolveSupportAmount({ units: 0 }).ok).toBe(false);
    expect(resolveSupportAmount({ units: 1.5 }).ok).toBe(false);
  });

  it("accepts custom USD within bounds", () => {
    const r = resolveSupportAmount({ customUsd: 12.5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cents).toBe(1250);
      expect(r.units).toBeNull();
    }
  });

  it("honors amount_cents alias", () => {
    expect(resolveSupportAmount({ amount_cents: 300 })).toMatchObject({
      ok: true,
      cents: 300,
    });
  });

  it("rejects below $3 and above $500", () => {
    expect(resolveSupportAmount({ customUsd: 2.99 }).ok).toBe(false);
    expect(resolveSupportAmount({ customCents: 299 }).ok).toBe(false);
    expect(resolveSupportAmount({ customUsd: 500.01 }).ok).toBe(false);
    expect(resolveSupportAmount({ customCents: 50001 }).ok).toBe(false);
  });

  it("accepts exact min and max", () => {
    expect(resolveSupportAmount({ customCents: 300 }).ok).toBe(true);
    expect(resolveSupportAmount({ customCents: 50000 }).ok).toBe(true);
  });

  it("requires units or custom", () => {
    expect(resolveSupportAmount({}).ok).toBe(false);
  });
});

describe("sanitizeSupporterFields", () => {
  it("strips URLs and truncates", () => {
    const r = sanitizeSupporterFields({
      handle: "  cool_dev!!! https://spam.example  ",
      message: "Great work visit www.evil.com please " + "x".repeat(200),
    });
    expect(r.handle!.length).toBeLessThanOrEqual(HANDLE_MAX);
    expect(r.handle).not.toMatch(/https?:\/\//);
    expect(r.message).not.toMatch(/www\.evil\.com/);
    expect(r.message!.length).toBeLessThanOrEqual(MESSAGE_MAX);
  });

  it("returns nulls for empty fields", () => {
    const r = sanitizeSupporterFields({ handle: "   ", message: "" });
    expect(r.handle).toBeNull();
    expect(r.message).toBeNull();
  });

  it("stripUrls removes common URL shapes", () => {
    expect(stripUrls("hi https://a.com bye")).toBe("hi bye");
    expect(stripUrls("see www.foo.io now")).toBe("see now");
  });
});

describe("negotiateSupportRail", () => {
  it("defaults browsers to html", () => {
    expect(negotiateSupportRail({})).toBe("html");
    expect(
      negotiateSupportRail({ accept: "text/html,application/xhtml+xml" })
    ).toBe("html");
  });

  it("routes Accept: application/json and ?rail=x402 to x402", () => {
    expect(negotiateSupportRail({ accept: "application/json" })).toBe("x402");
    expect(negotiateSupportRail({ rail: "x402" })).toBe("x402");
    expect(negotiateSupportRail({ rail: "USDC" })).toBe("x402");
    expect(negotiateSupportRail({ rail: "agent" })).toBe("x402");
  });
});

describe("buildStripeCheckoutPayload", () => {
  it("builds mode:payment payload with APMs, pay submit, and disclosure", () => {
    const r = buildStripeCheckoutPayload({
      units: 3,
      handle: "@zac",
      message: "Ship it",
      origin: "https://authichain.com",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const session = r.session as {
      mode: string;
      submit_type: string;
      automatic_payment_methods: { enabled: boolean };
      line_items: Array<{
        price_data: {
          unit_amount: number;
          currency: string;
          product_data: { description: string };
        };
      }>;
      metadata: Record<string, string>;
      success_url: string;
      custom_text: { submit: { message: string } };
    };
    expect(session.mode).toBe("payment");
    expect(session.submit_type).toBe("pay");
    expect(session.automatic_payment_methods.enabled).toBe(true);
    expect(session.line_items[0].price_data.unit_amount).toBe(1500);
    expect(session.line_items[0].price_data.currency).toBe("usd");
    expect(session.metadata.sku).toBe(SUPPORT_SKU);
    expect(session.metadata.kind).toBe(SUPPORT_KIND);
    expect(session.metadata.non_tax_deductible).toBe("true");
    expect(session.metadata.supporter_handle).toBe("@zac");
    expect(session.success_url).toContain("/coffee?thanks=1&session_id=");
    expect(session.line_items[0].price_data.product_data.description).toMatch(
      /not tax-deductible/i
    );
    expect(session.custom_text.submit.message).toMatch(/sole proprietor/i);
    const blob = JSON.stringify(session);
    expect(blob).not.toMatch(/AuthiChain, Inc\./);
    expect(blob).not.toMatch(/501\(c\)\(3\)/);
  });

  it("rejects card-testing $0.50 amounts", () => {
    expect(buildStripeCheckoutPayload({ customUsd: 0.5 }).ok).toBe(false);
  });
});

describe("buildX402SupportChallenge", () => {
  it("returns HTTP 402 descriptor with published Base USDC payTo", () => {
    const r = buildX402SupportChallenge({ units: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.status).toBe(402);
    expect(r.payTo).toBe(X402_PUBLISHED_PAY_TO);
    expect(r.body.x402Version).toBe(1);
    const accepts = r.body.accepts as Array<{
      maxAmountRequired: string;
      network: string;
      description: string;
    }>;
    expect(accepts[0].maxAmountRequired).toBe(centsToUsdcAtomic(500));
    expect(accepts[0].network).toBe("base");
    expect(r.headers["PAYMENT-REQUIRED"]).toBeTruthy();
    expect(accepts[0].description).toMatch(/not tax-deductible/i);
  });

  it("defaults to 1× coffee when no amount given", () => {
    const r = buildX402SupportChallenge({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount.cents).toBe(500);
  });

  it("centsToUsdcAtomic maps correctly", () => {
    expect(centsToUsdcAtomic(100)).toBe("1000000");
    expect(centsToUsdcAtomic(5)).toBe("50000");
    expect(centsToUsdcAtomic(500)).toBe("5000000");
  });
});

describe("Proof-of-Coffee Ed25519 receipts", () => {
  it("generates Ed25519 demo keypair with kid", async () => {
    const keys = await generateSupportReceiptKeypair();
    expect(keys.kid).toMatch(/^support-receipt-/);
    expect(keys.publicJwk.crv).toBe("Ed25519");
    expect(keys.publicJwk.alg).toBe("EdDSA");
    expect(keys.privateJwk.d).toBeTruthy();
  });

  it("mints and verifies a fiat paid receipt", async () => {
    const keys = await generateSupportReceiptKeypair();
    const minted = await mintProofOfCoffeeReceipt({
      rail: "fiat",
      paymentStatus: "paid",
      amountCents: 1500,
      handle: "@friend",
      message: "Keep shipping",
      paymentReference: "cs_test_123",
      brand: "authichain",
      kid: keys.kid,
      issuedAt: "2026-11-06T12:00:00.000Z",
      receiptId: "poc_test_fiat_1",
      privateJwk: keys.privateJwk,
    });
    expect(minted.record.type).toBe(RECEIPT_TYPE);
    expect(minted.record.promises).toEqual(COFFEE_PROMISES);
    expect(minted.record.amount.cents).toBe(1500);
    expect(minted.record.supporter.handle).toBe("@friend");
    expect(minted.jws.split(".").length).toBe(3);
    const verified = await verifyProofOfCoffeeReceipt(minted.jws, minted.jwks);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.record.receiptId).toBe("poc_test_fiat_1");
  });

  it("mints x402 settled receipt", async () => {
    const keys = await generateSupportReceiptKeypair();
    const minted = await mintProofOfCoffeeReceipt({
      rail: "x402",
      paymentStatus: "settled",
      amountCents: 500,
      paymentReference: "0xabc",
      kid: keys.kid,
      privateJwk: keys.privateJwk,
    });
    expect(minted.record.rail).toBe("x402");
    expect(minted.record.amount.currency).toBe("USDC");
    expect(minted.record.payment.network).toBe("base");
    expect(
      (await verifyProofOfCoffeeReceipt(minted.jws, keys.publicJwk)).ok
    ).toBe(true);
  });

  it("refuses unpaid fiat mint", async () => {
    await expect(
      mintProofOfCoffeeReceipt({
        rail: "fiat",
        paymentStatus: "unpaid",
        amountCents: 500,
      })
    ).rejects.toThrow(/paymentStatus === "paid"/);
  });

  it("detects tampered payload", async () => {
    const minted = await mintProofOfCoffeeReceipt({
      rail: "fiat",
      paymentStatus: "paid",
      amountCents: 500,
      receiptId: "poc_tamper",
    });
    const parts = minted.jws.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    payload.amount.cents = 99999;
    const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${parts[2]}`;
    const verified = await verifyProofOfCoffeeReceipt(tampered, minted.jwks);
    expect(verified.ok).toBe(false);
  });

  it("labels bundled sample signer when no live secret is bound", async () => {
    const minted = await mintProofOfCoffeeReceipt({
      rail: "fiat",
      paymentStatus: "paid",
      amountCents: 500,
      receiptId: "poc_sample_key",
    });
    expect(minted.sampleSigner).toBe(true);
    expect(minted.record.signer.kind).toBe("bundled_sample_ed25519");
    expect(minted.verification.kid).toBe(SAMPLE_COFFEE_KID);
    expect(SAMPLE_COFFEE_JWKS.keys[0]?.d).toBeUndefined();
  });
});

describe("paid session gate & thanks state", () => {
  it("isCoffeePaidSession requires paid + complete + coffee_support", () => {
    expect(
      isCoffeePaidSession({
        payment_status: "paid",
        status: "complete",
        metadata: { kind: SUPPORT_KIND },
      })
    ).toBe(true);
    expect(
      isCoffeePaidSession({
        payment_status: "unpaid",
        status: "complete",
        metadata: { kind: SUPPORT_KIND },
      })
    ).toBe(false);
    expect(
      isCoffeePaidSession({
        payment_status: "paid",
        status: "open",
        metadata: { kind: SUPPORT_KIND },
      })
    ).toBe(false);
    expect(
      isCoffeePaidSession({
        payment_status: "paid",
        status: "complete",
        metadata: { kind: "starter" },
      })
    ).toBe(false);
  });

  it("thanks=1 alone does not flip to paid receipt state", () => {
    expect(resolveCoffeePageMode({ thanksQuery: true, sessionId: null })).toBe(
      "buy"
    );
    expect(
      resolveCoffeePageMode({
        thanksQuery: true,
        sessionId: "cs_test_forged",
        paidSession: false,
      })
    ).toBe("buy");
  });

  it("verified paid session flips to Thanks for the coffee", () => {
    expect(
      resolveCoffeePageMode({
        thanksQuery: true,
        sessionId: "cs_test_paid",
        paidSession: true,
      })
    ).toBe("paid_thanks");
    expect(THANKS_COPY).toBe("Thanks for the coffee");
    expect(BUY_HEADING).toMatch(/Buy AuthiChain a coffee/i);
  });

  it("returning cookie is UX-only and ignored when a session_id is present", () => {
    expect(
      resolveCoffeePageMode({
        cookieFlag: { receiptId: "poc_abc", ts: 1 },
      })
    ).toBe("returning_thanks");
    expect(
      resolveCoffeePageMode({
        sessionId: "cs_test_forged",
        paidSession: false,
        cookieFlag: { receiptId: "poc_abc", ts: 1 },
      })
    ).toBe("buy");
  });

  it("serializes a non-PII thanks cookie", () => {
    const cookie = serializeCoffeeThanksCookie({
      receiptId: "poc_abc123",
      ts: 1730000000000,
    });
    expect(cookie).toContain("ac_coffee_thanks=");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie.toLowerCase()).not.toContain("httponly");
    expect(cookie).not.toMatch(/@/);
    expect(parseCoffeeThanksCookie(cookie)).toEqual({
      receiptId: "poc_abc123",
      ts: 1730000000000,
    });
    expect(parseCoffeeThanksFlag("not-a-flag")).toBeNull();
  });
});

describe("Stripe checkout create / retrieve fail closed", () => {
  it("falls back to the Payment Link when Stripe secret is absent", async () => {
    const r = await createCoffeeCheckoutSession({ units: 1 });
    expect(r).toEqual({
      ok: true,
      url: COFFEE_PAYMENT_LINK_URL,
      via: "payment_link",
    });
  });

  it("returns the Checkout URL when Stripe succeeds", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            url: "https://checkout.stripe.com/c/pay/cs_test_x",
          }),
          { status: 200 }
        )
    );
    const r = await createCoffeeCheckoutSession({
      units: 5,
      stripeSecretKey: "sk_test_x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toMatchObject({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_x",
      via: "stripe",
      amountCents: 2500,
    });
    const init = fetchImpl.mock.calls[0][1] as { body: URLSearchParams };
    const body = decodeURIComponent(String(init.body));
    expect(body).toContain("metadata[kind]=coffee_support");
    expect(body).toContain("submit_type=pay");
    expect(body).toContain("automatic_payment_methods");
    expect(body).toContain(
      "success_url=https://authichain.com/coffee?thanks=1&session_id={CHECKOUT_SESSION_ID}"
    );
    expect(body).not.toContain("/coffee/coffee");
  });

  it("falls back to the Payment Link on Stripe errors instead of 500", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const r = await createCoffeeCheckoutSession({
      units: 1,
      stripeSecretKey: "sk_test_x",
      fetchImpl,
    });
    expect(r).toEqual({
      ok: true,
      url: COFFEE_PAYMENT_LINK_URL,
      via: "payment_link",
    });
  });

  it("GET checkout health never creates a session", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const res = await coffeeCheckoutResponse(
      new Request("https://authichain.com/api/coffee/checkout"),
      { STRIPE_SECRET_KEY: "sk_test_x" },
      fetchImpl
    );
    expect(res.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();
    const body = (await res.json()) as { methods: string[] };
    expect(body.methods).toContain("POST");
  });

  it("POST form 303s; JSON returns { url }", async () => {
    const resForm = await coffeeCheckoutResponse(
      new Request("https://authichain.com/coffee", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "units=1",
      })
    );
    expect(resForm.status).toBe(303);
    expect(resForm.headers.get("location")).toBe(COFFEE_PAYMENT_LINK_URL);

    const resJson = await coffeeCheckoutResponse(
      new Request("https://authichain.com/api/coffee/checkout", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ units: 1 }),
      })
    );
    expect(resJson.status).toBe(200);
    expect(await resJson.json()).toEqual({
      url: COFFEE_PAYMENT_LINK_URL,
      via: "payment_link",
    });
  });

  it("POST invalid amount is 400 not 500", async () => {
    const res = await coffeeCheckoutResponse(
      new Request("https://authichain.com/api/coffee/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customUsd: 0.5 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("retrieveCoffeeCheckoutSession fail-closes on a forged id", async () => {
    expect(
      await retrieveCoffeeCheckoutSession("sk_test", "not-a-session")
    ).toBeNull();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "nope" } }), {
          status: 404,
        })
    ) as unknown as typeof fetch;
    expect(
      await retrieveCoffeeCheckoutSession(
        "sk_test",
        "cs_test_forgedabc",
        fetchImpl
      )
    ).toBeNull();
  });
});
