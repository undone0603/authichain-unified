import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderEstatePricingPage } from "../../workers/_shared/estate-pricing";
import { listedPlans, planById } from "../../src/lib/plans";
import {
  PRICING_PAGES,
  applyFixes,
  checkLivePages,
  checkPageLinks,
  checkStripe,
  expectedPlanIds,
  extractCheckoutLinks,
  isLiveStripeKey,
  mdCell,
  safeToAutoFix,
  type Finding,
} from "../checkout-watchdog";

const plansSrc = readFileSync(
  resolve(__dirname, "../../src/lib/plans.ts"),
  "utf8"
);

/** Serve what main renders, so the fixture never drifts from the catalogue. */
function siteFetch(
  overrides: Record<string, { status: number; body: string }> = {}
) {
  const calls: { url: string; method: string }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    if (overrides[url])
      return new Response(overrides[url].body, {
        status: overrides[url].status,
      });
    const page = PRICING_PAGES.find(p => p.url === url);
    if (page)
      return new Response(renderEstatePricingPage(page.origin), {
        status: 200,
      });
    const m = url.match(/^https:\/\/authichain\.com\/checkout\/([a-z0-9_]+)$/);
    const plan = m && planById(m[1] as never);
    if (plan)
      return new Response(
        `<h1>${plan.name}</h1><div>$${plan.price.toLocaleString("en-US")}</div>`
      );
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { impl, calls };
}

describe("checkout watchdog: live pages", () => {
  it("is green on what main renders", async () => {
    const { impl, calls } = siteFetch();
    const { findings, linked } = await checkLivePages(impl);
    expect(findings).toEqual([]);
    expect(linked["https://strainchain.io/pricing"].planIds).toEqual([
      "strainchain_farm",
      "strainchain_passport",
    ]);
    // Read-only: GETs only, and never Stripe or the session-opening API.
    expect(calls.every(c => c.method === "GET")).toBe(true);
    expect(calls.some(c => /stripe\.com|\/api\/checkout/.test(c.url))).toBe(
      false
    );
  });

  it("expects every listed paid plan on its brand's page", () => {
    for (const page of PRICING_PAGES) {
      const html = renderEstatePricingPage(page.origin);
      expect(extractCheckoutLinks(html).planIds.sort()).toEqual(
        [...expectedPlanIds(page.brand)].sort()
      );
    }
  });

  it("flags a stale card selling an unlisted plan (the Theater case)", () => {
    const page = PRICING_PAGES[1];
    const html = `${renderEstatePricingPage(page.origin)}<a href="https://authichain.com/checkout/theater_1">Subscribe</a>`;
    const findings = checkPageLinks(page, extractCheckoutLinks(html));
    expect(findings.map(f => [f.kind, f.planId])).toEqual([
      ["unlisted_plan_on_page", "theater_1"],
    ]);
    expect(findings[0].fixable).toBe(false);
  });

  it("flags a listed plan whose card vanished, and a stray Payment Link", () => {
    const page = PRICING_PAGES[0];
    const html = renderEstatePricingPage(page.origin)
      .replaceAll("/checkout/creator", "/pricing")
      .concat('<a href="https://buy.stripe.com/deadbeef">Pay</a>');
    const kinds = checkPageLinks(page, extractCheckoutLinks(html)).map(f => [
      f.kind,
      f.planId,
    ]);
    expect(kinds).toEqual([
      ["unknown_checkout_link", undefined],
      ["listed_plan_missing", "creator"],
    ]);
  });

  it("reads /api/checkout/plan links and aliases", () => {
    const links = extractCheckoutLinks(
      `<form action="/api/checkout/plan/starter"></form><a href='/checkout/dpp?x=1&amp;y=2'>x</a>`
    );
    expect(links.planIds).toEqual(["dpp", "starter"]);
  });

  it("reports a page that is down and a confirm page that 404s", async () => {
    const { impl } = siteFetch({
      "https://qron.space/pricing": { status: 522, body: "" },
      "https://authichain.com/checkout/strainchain_farm": {
        status: 404,
        body: "",
      },
    });
    const { findings } = await checkLivePages(impl);
    expect(findings.map(f => [f.kind, f.planId ?? f.url])).toEqual([
      ["page_down", "https://qron.space/pricing"],
      ["confirm_page_broken", "strainchain_farm"],
    ]);
  });
});

function stripeStub(
  opts: {
    inactivePrice?: string[];
    inactiveLink?: string[];
    amount?: Record<string, number>;
  } = {}
) {
  const paid = [...listedPlans("qron"), ...listedPlans("strainchain")].filter(
    p => p.price > 0
  );
  return async (path: string) => {
    if (path.startsWith("payment_links")) {
      return {
        status: 200,
        json: {
          has_more: false,
          data: paid
            .filter(p => p.stripe_payment_link)
            .map((p, i) => ({
              id: `plink_${i}`,
              url: p.stripe_payment_link,
              active: !opts.inactiveLink?.includes(p.id),
            })),
        },
      };
    }
    const priceId = decodeURIComponent(
      path.slice("prices/".length).split("?")[0]
    );
    const plan = paid.find(p => p.stripe_price_id === priceId)!;
    return {
      status: 200,
      json: {
        id: priceId,
        active: !opts.inactivePrice?.includes(plan.id),
        unit_amount: opts.amount?.[plan.id] ?? plan.price * 100,
        currency: "usd",
        type: plan.stripe_mode === "subscription" ? "recurring" : "one_time",
        product: { id: `prod_${plan.id}`, active: true },
      },
    };
  };
}

describe("checkout watchdog: Stripe", () => {
  it("is green when every listed price and link is live", async () => {
    expect(await checkStripe(stripeStub())).toEqual([]);
  });

  it("marks archived prices and dead links fixable, wrong amounts not", async () => {
    const findings = await checkStripe(
      stripeStub({
        inactivePrice: ["creator"],
        inactiveLink: ["starter"],
        amount: { dpp_readiness: 19900 },
      })
    );
    expect(findings.map(f => [f.kind, f.planId, f.fixable])).toEqual([
      ["price_inactive", "creator", true],
      ["price_mismatch", "dpp_readiness", false],
      ["payment_link_inactive", "starter", true],
    ]);
  });

  it("only trusts live keys", () => {
    expect(isLiveStripeKey("rk_live_x")).toBe(true);
    expect(isLiveStripeKey("sk_live_x")).toBe(true);
    expect(isLiveStripeKey("sk_test_x")).toBe(false);
    expect(isLiveStripeKey(undefined)).toBe(false);
  });
});

describe("checkout watchdog: --fix", () => {
  const f = (kind: Finding["kind"], planId: string): Finding => ({
    kind,
    planId,
    detail: "",
    fixable: true,
  });

  it("unlists a plan whose price is archived", () => {
    const { src, applied } = applyFixes(plansSrc, [
      f("price_inactive", "creator"),
    ]);
    expect(applied).toHaveLength(1);
    const block = src.slice(
      src.indexOf('id: "creator"'),
      src.indexOf("\n  },", src.indexOf('id: "creator"'))
    );
    expect(block).toMatch(/listed: false,/);
    // Only that plan changed.
    expect(src.replace(/\n\s+listed: false,/, "")).toBe(
      plansSrc.slice(
        0,
        plansSrc.indexOf("\n  },", plansSrc.indexOf('id: "creator"'))
      ) +
        plansSrc.slice(
          plansSrc.indexOf("\n  },", plansSrc.indexOf('id: "creator"'))
        )
    );
  });

  it("flips listed: true rather than adding a second key", () => {
    const { src } = applyFixes(plansSrc, [
      f("product_inactive", "qron_launch"),
    ]);
    const at = src.indexOf('id: "qron_launch"');
    const block = src.slice(at, src.indexOf("\n  },", at));
    expect(block.match(/listed:/g)).toHaveLength(1);
    expect(block).toMatch(/listed: false,/);
  });

  it("drops a deactivated Payment Link and keeps the price", () => {
    const { src } = applyFixes(plansSrc, [
      f("payment_link_inactive", "starter"),
    ]);
    expect(src).not.toContain(planById("starter")!.stripe_payment_link);
    expect(src).toContain(planById("starter")!.stripe_price_id);
  });

  it("does not apply findings that need a person", () => {
    const { src, applied } = applyFixes(plansSrc, [
      { kind: "price_mismatch", planId: "creator", detail: "", fixable: false },
    ]);
    expect(applied).toEqual([]);
    expect(src).toBe(plansSrc);
  });

  it("refuses to unlist most of the store at once", () => {
    const paid = [...listedPlans("qron"), ...listedPlans("strainchain")].filter(
      p => p.price > 0
    );
    expect(safeToAutoFix([f("price_inactive", paid[0].id)])).toBe(true);
    expect(safeToAutoFix(paid.map(p => f("price_inactive", p.id)))).toBe(false);
  });
});

describe("checkout watchdog: report", () => {
  it("escapes backslashes, pipes and newlines in table cells", () => {
    expect(mdCell("a|b\\c\nd")).toBe("a\\|b\\\\c d");
  });
});
