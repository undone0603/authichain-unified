import { describe, expect, it } from "vitest";
import {
  BATTERY_PASSPORT_PATH,
  daysUntilDeadline,
  isBatteryPassportPath,
  renderBatteryPassportPage,
  tryHandleBatteryPassport,
} from "./battery-passport-page.ts";
import { planById } from "../../../src/lib/plans";
import { ICP_SEO_SITEMAP_PATHS } from "./icp-seo-sitemap.ts";
import { GAP_MAP_DISCLAIMER } from "./battery-gap-map.ts";

const req = (path: string, method = "GET") =>
  new Request(`https://authichain.govchain.us${path}`, { method });

describe("battery passport offer page", () => {
  const html = renderBatteryPassportPage(new Date("2026-09-23T12:00:00Z"));
  const plan = planById("dpp_readiness")!;

  it("matches only its own path", () => {
    expect(isBatteryPassportPath("/battery-passport")).toBe(true);
    expect(isBatteryPassportPath("/battery-passport/")).toBe(true);
    expect(isBatteryPassportPath("/dpp")).toBe(false);
  });

  it("counts down to 18 Feb 2027 and never goes negative", () => {
    expect(daysUntilDeadline(new Date("2026-09-23T12:00:00Z"))).toBe(148);
    expect(daysUntilDeadline(new Date("2027-03-01T00:00:00Z"))).toBe(0);
    expect(html).toContain("<strong>148</strong>");
  });

  it("sells the existing $299 plan through the email-gated checkout, tagged by campaign", () => {
    expect(html).toContain(`$${plan.price}`);
    expect(html).toContain('action="/api/checkout/dpp"');
    expect(html).toContain('name="utm_campaign" value="battery-passport"');
    expect(html).not.toContain('href="/api/checkout/dpp"');
    expect(html).toContain('type="email" required');
  });

  it("lists exactly the plan's real deliverables and makes no invented claims", () => {
    for (const f of plan.features) expect(html).toContain(f);
    expect(html).not.toMatch(
      /testimonial|trusted by|customers love|guarantee/i
    );
    expect(html).toContain("Not legal advice");
  });

  it("publishes valid JSON-LD with the live price", () => {
    const m = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s
    );
    const ld = JSON.parse(m![1]);
    expect(ld["@graph"][0].offers.price).toBe(String(plan.price));
    expect(ld["@graph"][1]["@type"]).toBe("FAQPage");
  });

  it("is served by the handler and listed in the sitemap", async () => {
    const res = tryHandleBatteryPassport(req(BATTERY_PASSPORT_PATH))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(tryHandleBatteryPassport(req("/pricing"))).toBeNull();
    expect(ICP_SEO_SITEMAP_PATHS).toContain("/battery-passport");
  });

  it("adds a no-network gap map before #what-you-get with the exact disclaimer", () => {
    expect(html).toContain('id="gap-map"');
    expect(html).toContain("Not issued as a battery passport");
    expect(html).toContain(GAP_MAP_DISCLAIMER);
    const gap = html.indexOf('id="gap-map"');
    const what = html.indexOf('id="what-you-get"');
    expect(gap).toBeGreaterThan(-1);
    expect(what).toBeGreaterThan(gap);
    const section = html.slice(gap, what);
    for (const n of [
      "model",
      "statedWh",
      "ah",
      "nominalV",
      "cyclesLow",
      "cyclesHigh",
      "placing",
    ])
      expect(section).toContain(`name="${n}"`);
    for (const v of ["self", "cell_maker", "unknown"])
      expect(section).toContain(`<option value="${v}"`);
    expect(section).toContain("preventDefault");
    expect(section).not.toMatch(
      /fetch\(|XMLHttpRequest|sendBeacon|innerHTML|action=/
    );
    expect(section).toContain("textContent");
  });

  it("keeps the $299 dpp_readiness checkout tagged battery-passport", () => {
    expect(plan.id).toBe("dpp_readiness");
    expect(html).toContain(`$${plan.price}`);
    expect(html).toMatch(
      /<form class="checkout-email-form" action="\/api\/checkout\/dpp" method="get"/
    );
    expect(html).toContain('name="utm_campaign" value="battery-passport"');
  });

  it("answers the legal FAQ without claiming to issue a passport", () => {
    expect(html).toContain(
      "No. It is a readiness assessment and a structured record you can hand to the placing-on-market operator or your counsel. Confirm obligations against Regulation (EU) 2023/1542. Not legal advice."
    );
    expect(html).not.toContain("working passport you control");
    expect(html).not.toMatch(
      /gets your first passport published|publish your first passport/i
    );
    expect(html).toContain("gets you ready for your first passport");
  });
});
