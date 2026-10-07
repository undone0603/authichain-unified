import { describe, expect, it } from "vitest";
import { renderBatteryPassportPage } from "./battery-passport-page.ts";
import {
  BATTERY_CATEGORIES,
  LEAD_CONSENT,
  LEAD_ERROR_MESSAGE,
  LEAD_FINE_PRINT,
  LEAD_FORM_ENDPOINT,
  LEAD_FORM_SOURCE,
  LEAD_SUCCESS_MESSAGE,
  PACK_LEAD_JS,
  batteryLeadFormSection,
} from "./battery-lead-form.ts";

type Packed = Record<string, string>;
const packLead = new Function(`${PACK_LEAD_JS}; return packLead;`)() as (
  f: Record<string, unknown>,
  loc?: { origin: string; pathname: string; search: string }
) => Packed;

describe("battery passport lead form (AE-20261002-CFD-04)", () => {
  const html = renderBatteryPassportPage(new Date("2026-09-23T12:00:00Z"));
  const section = batteryLeadFormSection();

  it("is on the page between the FAQ and the checkout section", () => {
    const faq = html.indexOf('id="faq"');
    const lead = html.indexOf('id="scope-pilot"');
    const cta = html.indexOf('id="get-started"');
    expect(faq).toBeGreaterThan(-1);
    expect(lead).toBeGreaterThan(faq);
    expect(cta).toBeGreaterThan(lead);
  });

  it("posts JSON to the existing /api/leads/capture route, tagged by source", () => {
    expect(LEAD_FORM_ENDPOINT).toBe("/api/leads/capture");
    expect(section).toContain(`fetch("/api/leads/capture"`);
    expect(section).toContain(`name="source" value="${LEAD_FORM_SOURCE}"`);
    expect(section).toContain('"Content-Type": "application/json"');
    expect(section).not.toContain("innerHTML");
  });

  it("has labelled fields from the copy, with required ones marked", () => {
    for (const id of [
      "lf-name",
      "lf-email",
      "lf-company",
      "lf-role",
      "lf-target",
      "lf-notes",
    ])
      expect(section).toContain(`for="${id}"`);
    for (const n of ["name", "email", "company"])
      expect(section).toMatch(
        new RegExp(`name="${n}" type="(text|email)" required`)
      );
    expect(section).toContain('type="email" required');
    for (const c of BATTERY_CATEGORIES)
      expect(section).toContain(`value="${c}"`);
    expect(section).toContain("<legend>Battery categories");
    expect(section).toContain('aria-live="polite"');
    expect(section).toContain("Request a scoping call");
  });

  it("shows the approved consent line and the fine print", () => {
    expect(section).toContain(LEAD_CONSENT);
    expect(section).not.toContain("PLACEHOLDER");
    expect(section).not.toContain("lf-placeholder");
    expect(section).toContain('<a href="/privacy">Privacy policy</a>');
    expect(section).toContain(LEAD_FINE_PRINT.replace(/'/g, "&#39;"));
    expect(section).toContain(JSON.stringify(LEAD_SUCCESS_MESSAGE));
    expect(section).toContain(JSON.stringify(LEAD_ERROR_MESSAGE));
  });

  it("adds no prices, no 'No sales call' wording and no social proof", () => {
    expect(section).not.toMatch(/\$\s?\d/);
    expect(section).not.toMatch(/no sales call/i);
    expect(section).not.toMatch(
      /testimonial|trusted by|customers love|guarantee/i
    );
    expect(section).not.toMatch(/AuthiChain,? Inc/);
    expect(section).not.toContain("Gap analysis");
    expect(section).not.toContain("Data map");
    expect(section).not.toContain("Complete passport record");
    expect(section).not.toMatch(/done for you/i);
    expect(section).not.toContain("Pricing is shared on the call");
  });

  it("sends the extra fields on their own and as a product_interest summary", () => {
    const body = packLead(
      {
        name: "  Ada  Lovelace ",
        email: "ada@example.com",
        company: "Example Cells",
        role: "Compliance lead",
        categories: ["LMT (e-bikes, scooters)", "EV"],
        target: "Q1 2027",
        notes: "two\nmodels",
      },
      {
        origin: "https://authichain.com",
        pathname: "/battery-passport",
        search: "?utm_source=x&utm_campaign=bp&email=leak",
      }
    );
    expect(body).toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
      source: "battery-passport-page",
      product_interest:
        "battery-passport | Company: Example Cells | Role: Compliance lead | Battery categories: LMT (e-bikes, scooters), EV | Target date: Q1 2027 | Notes: two models",
      company: "Example Cells",
      role: "Compliance lead",
      categories: ["LMT (e-bikes, scooters)", "EV"],
      target_date: "Q1 2027",
      message: "two models",
      page_url: "https://authichain.com/battery-passport",
      utm_source: "x",
      utm_campaign: "bp",
    });
  });

  it("caps product_interest at 2000 characters", () => {
    const body = packLead({
      email: "a@b.co",
      name: "A",
      company: "C",
      categories: ["EV"],
      notes: "x".repeat(5000),
    });
    expect(body.product_interest.length).toBeLessThanOrEqual(2000);
    expect(body.page_url).toBeUndefined();
  });
});
