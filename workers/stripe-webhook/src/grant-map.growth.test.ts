/**
 * grant-map.ts duplicates catalogue and loop constants on purpose (this Worker
 * does not import src/lib). Duplication only stays safe if drift is caught, so
 * these tests compare the duplicate against the real source of truth.
 */
import { describe, expect, it } from "vitest";
import {
  CATALOG_GRANT_RPC,
  FOUNDER_EMAILS,
  GRANT_CAS_RETRIES,
  LOOP_BY_PLAN,
  alreadyGrantedSession,
  grantForCheckout,
  grantForPrice,
  grantReceiptKey,
  grantReplayAction,
  grantStacksOnRepeat,
  isFounderEmail,
  isNonFounderFirstSale,
  loopForPlan,
  stackedPackCredits,
} from "./grant-map";
import { GROWTH_LOOPS } from "../../../src/lib/growth/loops";
import { FOUNDER_EMAILS as CANONICAL_FOUNDERS } from "../../../src/lib/billing/live-catalog";
import {
  CATALOG_GRANT_RPC as apexCatalogGrantRpc,
  PROVISION_CAS_RETRIES,
  grantReceiptKey as apexGrantReceiptKey,
  stackedPackCredits as apexStackedPackCredits,
} from "../../../src/lib/provisioning";

describe("checkout grant replay", () => {
  it("skips a second grant for the same checkout session", () => {
    expect(alreadyGrantedSession("cs_123", "cs_123")).toBe(true);
    expect(alreadyGrantedSession("cs_old", "cs_123")).toBe(false);
    expect(alreadyGrantedSession(null, "cs_123")).toBe(false);
    expect(alreadyGrantedSession(undefined, "cs_123")).toBe(false);
  });

  it("retries when the prior-session lookup fails", () => {
    expect(grantReplayAction({ ok: false }, "cs_123")).toBe("retry");
    expect(grantReplayAction({ ok: true, sessionId: "cs_123" }, "cs_123")).toBe(
      "skip"
    );
    expect(grantReplayAction({ ok: true, sessionId: null }, "cs_123")).toBe(
      "grant"
    );
  });

  it("skips an older session after a newer purchase stamped last_grant_session_id", () => {
    expect(
      grantReplayAction(
        { ok: true, sessionId: "cs_new", receiptExists: false },
        "cs_old"
      )
    ).toBe("grant");
    expect(
      grantReplayAction(
        { ok: true, sessionId: "cs_new", receiptExists: true },
        "cs_old"
      )
    ).toBe("skip");
  });

  it("uses the same grant receipt key as provisioning.ts", () => {
    expect(grantReceiptKey("cs_1")).toBe("grant:cs_1");
    expect(grantReceiptKey("cs_1")).toBe(apexGrantReceiptKey("cs_1"));
  });

  it("uses the same catalog grant RPC as provisioning.ts", () => {
    expect(CATALOG_GRANT_RPC).toBe("grant_catalog_checkout_session");
    expect(CATALOG_GRANT_RPC).toBe(apexCatalogGrantRpc);
  });
});

describe("one-time pack stacking stays in lockstep with provisioning.ts", () => {
  const cases: Array<{
    name: string;
    row: Record<string, unknown> | null;
    pack: number;
  }> = [
    { name: "empty profile", row: null, pack: 100 },
    {
      name: "60 left + Starter",
      row: { generations_limit: 100, generations_used: 40 },
      pack: 100,
    },
    {
      name: "60 left + Creator",
      row: { generations_limit: 100, generations_used: 40 },
      pack: 500,
    },
    {
      name: "zero remaining",
      row: { generations_limit: 100, generations_used: 100 },
      pack: 100,
    },
    {
      name: "over-used",
      row: { generations_limit: 100, generations_used: 120 },
      pack: 100,
    },
    { name: "missing columns", row: {}, pack: 100 },
    {
      name: "unlimited sentinel",
      row: { generations_limit: 999999, generations_used: 12 },
      pack: 100,
    },
  ];

  it("matches the apex stackedPackCredits formula on every fixture", () => {
    for (const c of cases) {
      expect(stackedPackCredits(c.row, c.pack), c.name).toEqual(
        apexStackedPackCredits(c.row, c.pack)
      );
    }
  });

  it("adds a Starter pack onto leftover credits (60 + 100 = 160)", () => {
    expect(
      stackedPackCredits({ generations_limit: 100, generations_used: 40 }, 100)
    ).toEqual({ generations_limit: 160, generations_used: 0 });
  });

  it("uses the same CAS retry budget as provisionPurchase", () => {
    expect(GRANT_CAS_RETRIES).toBe(PROVISION_CAS_RETRIES);
  });

  it("stacks one-time packs and replaces subscription period grants", () => {
    expect(
      grantStacksOnRepeat(grantForPrice("price_1UIoEVGqTruSqV8T61lp48wB")!)
    ).toBe(true);
    expect(
      grantStacksOnRepeat(grantForPrice("price_1UIoEYGqTruSqV8TCXTNipvh")!)
    ).toBe(true);
    expect(
      grantStacksOnRepeat(grantForPrice("price_1USNoSGqTruSqV8ThTIW7Ej8")!)
    ).toBe(false);
    expect(
      grantStacksOnRepeat(grantForPrice("price_1UJjzPGqTruSqV8TmhFSc8vh")!)
    ).toBe(false);
  });
});

describe("loop identity stays in lockstep with src/lib/growth/loops.ts", () => {
  it("covers exactly the skus that have a loop", () => {
    expect(Object.keys(LOOP_BY_PLAN).sort()).toEqual(
      GROWTH_LOOPS.map(l => l.sku).sort()
    );
  });

  it("maps each sku to the right loop id", () => {
    for (const loop of GROWTH_LOOPS) {
      expect(loopForPlan(loop.sku)!.loop).toBe(loop.id);
    }
  });

  it("names a purchase event that the loop actually declares", () => {
    for (const loop of GROWTH_LOOPS) {
      const { purchaseEvent } = loopForPlan(loop.sku)!;
      expect(loop.events).toContain(purchaseEvent);
      expect(purchaseEvent).toMatch(/^purchase_.+_succeeded$/);
    }
  });

  it("returns null for plans with no loop", () => {
    for (const plan of [
      "creator",
      "qron_launch",
      "qron_launch_annual",
      "strainchain_farm",
      "free",
      "",
    ]) {
      expect(loopForPlan(plan)).toBeNull();
    }
    expect(loopForPlan(null)).toBeNull();
    expect(loopForPlan(undefined)).toBeNull();
  });
});

describe("founder list stays in lockstep with live-catalog.ts", () => {
  it("matches exactly", () => {
    expect([...FOUNDER_EMAILS].sort()).toEqual([...CANONICAL_FOUNDERS].sort());
  });

  it("detects founders case- and whitespace-insensitively", () => {
    expect(isFounderEmail("  AuthiChain@Gmail.com ")).toBe(true);
    expect(isFounderEmail("undone.k@gmail.com")).toBe(true);
    expect(isFounderEmail("buyer@example.com")).toBe(false);
    expect(isFounderEmail(null)).toBe(false);
    expect(isFounderEmail(undefined)).toBe(false);
  });

  it("treats owned @domain entries as founder", () => {
    expect(isFounderEmail("ops@authichain.com")).toBe(true);
    expect(isFounderEmail("smoke+dpp@authichain.com")).toBe(true);
    expect(isFounderEmail("a@authichain.com.au")).toBe(false);
  });
});

describe("first-sale alert excludes owner self-tests", () => {
  const stranger = {
    amountTotal: 2900,
    email: "buyer@example.com",
  };

  it("alerts for an unmarked stranger Starter payment", () => {
    expect(isNonFounderFirstSale(stranger)).toBe(true);
  });

  it("does not alert for the allowlisted $10 self-test even with a stranger email", () => {
    expect(
      isNonFounderFirstSale({
        ...stranger,
        amountTotal: 1000,
        paymentIntentId: "pi_3UHcQfGqTruSqV8T18dYFwd3",
      })
    ).toBe(false);
  });

  it("does not alert when metadata marks the checkout as an owner test", () => {
    expect(
      isNonFounderFirstSale({
        ...stranger,
        metadata: { test_payment: "owner" },
      })
    ).toBe(false);
    expect(
      isNonFounderFirstSale({
        ...stranger,
        metadata: { is_self_test: "true" },
      })
    ).toBe(false);
  });
});

describe("an unmapped price must never look like a starter purchase", () => {
  it("grants Launch Annual 1,200 generations by price id, not by amount", () => {
    expect(grantForPrice("price_1USNoSGqTruSqV8ThTIW7Ej8")).toEqual({
      plan: "qron_launch_annual",
      brand: "qron",
      generations: 1200,
      refillOnInvoicePaid: true,
    });
    expect(grantForCheckout({ amountTotal: 19000 })).toBeNull();
    expect(loopForPlan("qron_launch_annual")).toBeNull();
  });

  it("grantForPrice returns null for a price outside the map", () => {
    expect(grantForPrice("price_does_not_exist")).toBeNull();
    expect(grantForPrice(null)).toBeNull();
    expect(grantForPrice(undefined)).toBeNull();
  });

  it("loopForPlan(null) yields no loop, so no purchase event is recorded", () => {
    // Regression: the webhook derives `plan` with a `|| "starter"` fallback for
    // the profiles upsert. Feeding that default into the growth rail would file
    // a false purchase_starter_succeeded — the one number the 14-day kill
    // decision reads. The call site must pass grant?.plan instead.
    const unmapped = grantForPrice("price_does_not_exist");
    expect(loopForPlan(unmapped?.plan ?? null)).toBeNull();
  });

  it("the unlisted smoke prices map to no loop", () => {
    // $1 First Dollar and Seal $99 exist in Stripe but must never be marketed
    // or counted as a first stranger dollar.
    for (const priceId of [
      "price_1UIRF6GqTruSqV8TRjDYCkpi",
      "price_1UIRF7GqTruSqV8THhlI3zxp",
      "price_1UJbwzGqTruSqV8TJlaINJyW",
    ]) {
      const g = grantForPrice(priceId);
      expect(loopForPlan(g?.plan ?? null)).toBeNull();
    }
  });
});

describe("grantForCheckout", () => {
  it("maps a $29 session with no price id to starter", () => {
    expect(
      grantForCheckout({ priceId: null, amountTotal: 2900 })
    ).toMatchObject({
      plan: "starter",
      generations: 100,
    });
  });

  it("does not guess a shared $299 amount", () => {
    expect(grantForCheckout({ priceId: null, amountTotal: 29900 })).toBeNull();
  });
});
