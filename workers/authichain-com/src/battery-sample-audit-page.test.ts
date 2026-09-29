import { describe, expect, it } from "vitest";
import {
  SAMPLE_AUDIT_PATH,
  SAMPLE_LABEL,
  buildSampleAudit,
  isSampleAuditPath,
  renderSampleAuditPage,
} from "./battery-sample-audit-page.ts";
import { renderBatteryPassportPage } from "./battery-passport-page.ts";
import { renderDppCheckPage } from "./dpp-check-page.ts";
import { ICP_SEO_SITEMAP_PATHS } from "./icp-seo-sitemap.ts";
import { planById } from "../../../src/lib/plans";

const now = new Date("2026-09-29T12:00:00Z");

describe("sample battery readiness assessment", () => {
  const html = renderSampleAuditPage(now);
  const plan = planById("dpp_readiness")!;
  const audit = buildSampleAudit(now);

  it("matches only its own path", () => {
    expect(isSampleAuditPath(SAMPLE_AUDIT_PATH)).toBe(true);
    expect(isSampleAuditPath(`${SAMPLE_AUDIT_PATH}/`)).toBe(true);
    expect(isSampleAuditPath("/battery-passport")).toBe(false);
  });

  it("says plainly that the brand and battery are fictional", () => {
    expect(html).toContain(SAMPLE_LABEL);
    expect(html).not.toMatch(
      /testimonial|trusted by|customers love|guarantee/i
    );
    expect(html).not.toMatch(/mendo/i);
    expect(html).toContain("not legal advice");
  });

  it("derives every figure from the gap map and the readiness score", () => {
    expect(audit.pack.vTimesAh).toBe(672);
    expect(audit.pack.consistent).toBe(false);
    expect(audit.pack.deviation).toBe(0.0417);
    expect(audit.readiness.score).toBe(30);
    expect(audit.days).toBe(142);
    expect(html).toContain("<strong>142</strong>");
    expect(html).toContain("<strong>30/100</strong>");
    expect(html).toContain("672 Wh");
    expect(html).toContain("4.17%");
    expect(audit.counts.user_provided).toBe(5);
    expect(audit.rows.length).toBe(
      Object.values(audit.counts).reduce((a, b) => a + b, 0)
    );
  });

  it("never asks the cell maker for identifiers", () => {
    const request = audit.actions[2].body;
    expect(request).not.toMatch(/identifier|declaration of conformity/i);
    expect(request).toMatch(/chemistry/);
  });

  it("sells the existing $299 plan through the gated checkout, tagged by campaign", () => {
    expect(html).toContain(`$${plan.price}`);
    for (const f of plan.features) expect(html).toContain(f);
    expect(html).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(html).toContain('name="utm_campaign" value="battery-sample-audit"');
    expect(html).toContain('type="email" required');
    expect(html).not.toContain('href="/api/checkout');
  });

  it("publishes valid JSON-LD with the live price", () => {
    const m = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s
    );
    const ld = JSON.parse(m![1]);
    expect(ld.about.offers.price).toBe(String(plan.price));
  });

  it("is linked from the offer page and the free check, and listed in the sitemap", () => {
    expect(renderBatteryPassportPage(now)).toContain(
      `href="${SAMPLE_AUDIT_PATH}"`
    );
    const result = renderDppCheckPage(
      new URL(
        "https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes"
      ),
      now
    );
    expect(result).toContain(`href="${SAMPLE_AUDIT_PATH}"`);
    expect(ICP_SEO_SITEMAP_PATHS).toContain(SAMPLE_AUDIT_PATH);
  });
});
