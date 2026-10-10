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
    expect(html).toContain('action="https://authichain.com/checkout/dpp_readiness"');
    expect(html).toContain('name="utm_campaign" value="battery-passport"');
    expect(html).not.toContain('href="/api/checkout');
    expect(html).toContain('type="email" required');
  });

  it("lists the workspace grant and leaves the unbuilt report and credit off the page", () => {
    for (const line of [
      "Self-serve activation",
    ])
      expect(html).toContain(line);
    expect(html).not.toContain("Written EU DPP readiness assessment");
    expect(html).not.toContain("written readiness assessment");
    expect(html).not.toContain("$299 credited toward AuthiChain Basic");
    expect(html).not.toContain("who in your supply chain holds it");
    expect(html).not.toMatch(/we reply|we'll reply|will reply/i);
    expect(html).toContain(
      "No. The $299 checkout is self-serve. The scoping form on this page is optional. We may email you at the work address in that form to set up a scoping call."
    );
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

  it("keeps the $299 checkout ahead of the optional scoping form", () => {
    const hero = html.indexOf('id="hero-checkout"');
    const form = html.indexOf('id="lead-form"');
    const bottom = html.indexOf('id="cta-checkout"');
    expect(hero).toBeGreaterThan(-1);
    expect(form).toBeGreaterThan(hero);
    expect(bottom).toBeGreaterThan(form);
    expect(html).toContain("Get passport-ready");
    expect(html).toContain("The scoping form on this page is optional");
    expect(html).not.toMatch(/No sales call/i);
    expect(html).not.toMatch(/No call booking/i);
  });

  it("keeps the $299 dpp_readiness checkout tagged battery-passport", () => {
    expect(plan.id).toBe("dpp_readiness");
    expect(html).toContain(`$${plan.price}`);
    expect(html).toMatch(
      /<form class="checkout-email-form" action="https:\/\/authichain\.com\/checkout\/dpp_readiness" method="post"/
    );
    expect(html).toContain('name="utm_campaign" value="battery-passport"');
  });

  it("answers the legal FAQ without claiming to issue a passport", () => {
    expect(html).toContain(
    expect(html).toContain("published claims workspace battery passport for polygon-anchor");
    );
    // RESEARCH-GATE fix 13 (PM-331): the $299 is a workspace, not an assessment.
    expect(html).not.toContain("It is a readiness assessment");
    expect(html).not.toContain('"serviceType":"EU Digital Battery Passport readiness assessment"');
    expect(html).toContain('"serviceType":"Workspace for EU Digital Battery Passport figures"');
    expect(html).not.toContain("working passport you control");
    expect(html).not.toContain("signed and publicly verifiable");
    expect(html).toContain(
      "A published workspace record is a signed proof only when its Ed25519 signature and a mainnet anchor both check out."
    );
    // PM-378: the demonstration-record line (and its Polygon anchor tx) is cut.
    expect(html).not.toContain("polygon-anchor-1");
    expect(html).not.toContain("only published demonstration record");
    // PM-374: no polygonscan link to the anchor tx (wallet ownership not proven).
    expect(html).not.toContain("polygonscan.com");
    expect(html).not.toMatch(
      /gets your first passport published|publish your first passport/i
    );
    expect(html).toContain("gets you ready for your first passport");
  });

  it("GB-17: never promises 50 workspace generations", () => {
    for (const re of [/50 workspace generations/i, /50 generations/i, /fifty (workspace )?generations/i])
      expect(html).not.toMatch(re);
  });

  it("RES-214: never calls the offer a readiness assessment", () => {
    expect(html).not.toMatch(/readiness assessment/i);
    expect(html).not.toMatch(/AuthiChain workspace/i);
  });
});
