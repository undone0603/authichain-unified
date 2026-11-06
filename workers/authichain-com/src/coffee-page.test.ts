import { describe, expect, it, vi } from "vitest";
import {
  BUY_HEADING,
  COFFEE_CANONICAL,
  COFFEE_CHECKOUT_PATH,
  COFFEE_JWKS_PATH,
  COFFEE_PATH,
  COFFEE_PAYMENT_LINK_URL,
  COFFEE_SAMPLE_RECEIPT_PATH,
  FREE_PREVIEW_V1,
  NON_TAX_DEDUCTIBLE_DISCLOSURE,
  SAMPLE_COFFEE_KID,
  SUPPORT_KIND,
  THANKS_COPY,
  verifyProofOfCoffeeReceipt,
} from "../../../src/lib/support-coffee";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402";
import {
  isCoffeeHtmlPath,
  isCoffeePath,
  renderCoffeePage,
  tryHandleCoffee,
} from "./coffee-page.ts";

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`https://authichain.com${path}`, init);
}

describe("coffee page paths", () => {
  it("matches HTML, checkout, and artifact paths", () => {
    expect(isCoffeeHtmlPath(COFFEE_PATH)).toBe(true);
    expect(isCoffeeHtmlPath(`${COFFEE_PATH}/`)).toBe(true);
    expect(isCoffeePath(COFFEE_JWKS_PATH)).toBe(true);
    expect(isCoffeePath(COFFEE_SAMPLE_RECEIPT_PATH)).toBe(true);
    expect(isCoffeePath(COFFEE_CHECKOUT_PATH)).toBe(true);
    expect(isCoffeePath("/api/support")).toBe(false);
    expect(isCoffeeHtmlPath("/pricing")).toBe(false);
  });
});

describe("renderCoffeePage", () => {
  it("renders presets, disclosure, FREE-PREVIEW-V1, and lead-capture", () => {
    const html = renderCoffeePage({ mode: "buy" });
    expect(html).toContain(BUY_HEADING);
    expect(html).toContain("1× coffee — $5");
    expect(html).toContain("3× coffee — $15");
    expect(html).toContain("5× coffee — $25");
    expect(html).toContain("rail=x402");
    expect(html).toContain("Proof-of-Coffee");
    expect(html).toContain("Apple Pay");
    expect(html).toContain(FREE_PREVIEW_V1);
    expect(html).toContain(
      'name="authichain:preview" content="FREE-PREVIEW-V1"'
    );
    expect(html).toContain("Not a charity donation");
    expect(html).toContain(NON_TAX_DEDUCTIBLE_DISCLOSURE);
    expect(html).toContain('id="lead-capture"');
    expect(html).toContain("estate-nav");
    expect(html).toContain("estate-footer");
    expect(html).toContain(X402_PUBLISHED_PAY_TO);
    expect(html).toContain(`action="${COFFEE_PATH}"`);
    expect(html).not.toContain("AuthiChain, Inc.");
    expect(html).not.toContain("501(c)(3)");
    expect(html).not.toContain("50 workspace generations");
    expect(html).not.toContain("never expire");
    expect(html).not.toContain("no expiry");
    expect(html).not.toContain("10 business days");
    expect(html).not.toContain("qron_launch");
    expect(html).not.toContain("strainchain_farm");
    expect(html).toContain(COFFEE_CANONICAL);
  });

  it("paid view shows Thanks for the coffee and the JWS", () => {
    const html = renderCoffeePage({
      mode: "paid_thanks",
      receipt: {
        record: {
          type: "authichain.proof_of_coffee.v1",
          receiptId: "poc_paid1",
          issuedAt: "2026-11-06T12:00:00.000Z",
          brand: "authichain",
          sku: "proof_of_support_coffee",
          rail: "fiat",
          amount: { currency: "USD", cents: 500, display: "$5.00" },
          payment: {
            status: "paid",
            provider: "stripe",
            reference: "cs_test_paid",
            network: null,
          },
          supporter: { handle: null, message: null },
          promises: {
            equity: false,
            tokens: false,
            sla: false,
            productEntitlement: false,
            taxDeductible: false,
            charity: false,
          },
          disclosure: NON_TAX_DEDUCTIBLE_DISCLOSURE,
          note: "thanks",
          signer: {
            kind: "bundled_sample_ed25519",
            kid: SAMPLE_COFFEE_KID,
            sample: true,
          },
        },
        jws: "aaa.bbb.ccc",
        sampleSigner: true,
        kid: SAMPLE_COFFEE_KID,
      },
      thanksFlag: { receiptId: "poc_paid1", ts: 1 },
    });
    expect(html).toContain(THANKS_COPY);
    expect(html).toContain("aaa.bbb.ccc");
    expect(html).toContain("Buy another coffee");
    expect(html).toContain("bundled demonstration Ed25519");
  });
});

describe("tryHandleCoffee", () => {
  it("serves HTML with security headers matching the sample passport", async () => {
    const res = await tryHandleCoffee(req(COFFEE_PATH));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toContain("text/html");
    expect(res!.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res!.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'"
    );
    const html = await res!.text();
    expect(html).toContain(BUY_HEADING);
    expect(html).toContain(FREE_PREVIEW_V1);
    expect(html).not.toContain(`>${THANKS_COPY}<`);
  });

  it("GET Accept:json and ?rail=x402 return HTTP 402 with published payTo", async () => {
    const json = await tryHandleCoffee(
      req(COFFEE_PATH, { headers: { accept: "application/json" } })
    );
    expect(json!.status).toBe(402);
    expect(json!.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    const body = (await json!.json()) as {
      accepts: Array<{ payTo: string; maxAmountRequired: string }>;
    };
    expect(body.accepts[0].payTo).toBe(X402_PUBLISHED_PAY_TO);
    expect(body.accepts[0].maxAmountRequired).toBe("5000000");

    const units = await tryHandleCoffee(
      req(`${COFFEE_PATH}?rail=x402&units=3`)
    );
    expect(units!.status).toBe(402);
    const body3 = (await units!.json()) as {
      accepts: Array<{ maxAmountRequired: string }>;
    };
    expect(body3.accepts[0].maxAmountRequired).toBe("15000000");
  });

  it("POST without Stripe secret 303s to the live Payment Link", async () => {
    const res = await tryHandleCoffee(
      req(COFFEE_PATH, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "units=1",
      })
    );
    expect(res!.status).toBe(303);
    expect(res!.headers.get("location")).toBe(COFFEE_PAYMENT_LINK_URL);
  });

  it("paid return renders Thanks for the coffee and a verifiable receipt", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/v1/checkout/sessions/cs_test_paidcoffee");
      return new Response(
        JSON.stringify({
          id: "cs_test_paidcoffee",
          payment_status: "paid",
          status: "complete",
          amount_total: 500,
          metadata: { kind: SUPPORT_KIND, amount_cents: "500" },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const res = await tryHandleCoffee(
      req(`${COFFEE_PATH}?thanks=1&session_id=cs_test_paidcoffee`),
      { STRIPE_SECRET_KEY: "sk_test_x" },
      fetchImpl
    );
    expect(res!.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain(THANKS_COPY);
    expect(html).toContain("Proof-of-Coffee receipt");
    expect(res!.headers.get("set-cookie")).toMatch(/ac_coffee_thanks=/);
    expect(res!.headers.get("set-cookie") || "").not.toMatch(/HttpOnly/i);
    expect(html).toMatch(/eyJ/);
  });

  it("unpaid or forged session_id does not flip to the paid receipt state", async () => {
    const unpaidFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "cs_test_unpaidcoffee",
            payment_status: "unpaid",
            status: "open",
            metadata: { kind: SUPPORT_KIND },
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;
    const unpaid = await tryHandleCoffee(
      req(`${COFFEE_PATH}?thanks=1&session_id=cs_test_unpaidcoffee`),
      { STRIPE_SECRET_KEY: "sk_test_x" },
      unpaidFetch
    );
    const unpaidHtml = await unpaid!.text();
    expect(unpaidHtml).toContain(BUY_HEADING);
    expect(unpaidHtml).not.toContain("Proof-of-Coffee receipt");
    expect(unpaid!.headers.get("set-cookie")).toBeNull();

    const forged = await tryHandleCoffee(
      req(`${COFFEE_PATH}?thanks=1&session_id=cs_test_forgedcoffee`),
      { STRIPE_SECRET_KEY: "sk_test_x" },
      vi.fn(
        async () => new Response("{}", { status: 404 })
      ) as unknown as typeof fetch
    );
    const forgedHtml = await forged!.text();
    expect(forgedHtml).toContain(BUY_HEADING);
    expect(forgedHtml).not.toContain(`>${THANKS_COPY}<`);

    const bareThanks = await tryHandleCoffee(req(`${COFFEE_PATH}?thanks=1`));
    const bareHtml = await bareThanks!.text();
    expect(bareHtml).toContain(BUY_HEADING);
    expect(bareHtml).not.toContain("Proof-of-Coffee receipt");
  });

  it("serves sample receipt + jwks without live passport keys", async () => {
    const jwksRes = await tryHandleCoffee(req(COFFEE_JWKS_PATH));
    expect(jwksRes!.status).toBe(200);
    const jwks = (await jwksRes!.json()) as {
      keys: Array<{ kid: string; d?: string }>;
      sample: boolean;
    };
    expect(jwks.keys[0].kid).toBe(SAMPLE_COFFEE_KID);
    expect(jwks.keys[0].d).toBeUndefined();
    expect(jwks.sample).toBe(true);

    const sampleRes = await tryHandleCoffee(req(COFFEE_SAMPLE_RECEIPT_PATH));
    const sample = (await sampleRes!.json()) as {
      sampleOnly: boolean;
      jws: string;
      jwks: { keys: object[] };
      record: { promises: Record<string, boolean> };
    };
    expect(sample.sampleOnly).toBe(true);
    expect(sample.record.promises.taxDeductible).toBe(false);
    expect(
      (await verifyProofOfCoffeeReceipt(sample.jws, sample.jwks as never)).ok
    ).toBe(true);
  });

  it("ignores unrelated paths so /api/support stays untouched", async () => {
    expect(await tryHandleCoffee(req("/api/support"))).toBeNull();
    expect(await tryHandleCoffee(req("/pricing"))).toBeNull();
  });
});
