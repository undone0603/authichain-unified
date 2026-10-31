import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import UpgradeRequiredPage from "./page";

async function render(reason?: string): Promise<string> {
  const element = await UpgradeRequiredPage({
    searchParams: Promise.resolve(reason ? { reason } : {}),
  });
  return renderToStaticMarkup(element);
}

describe("/billing/upgrade-required", () => {
  it("says why access was refused", async () => {
    expect(await render("inactive")).toContain("is not active");
    expect(await render("no_plan")).toContain("does not have");
  });

  it("makes no false compliance claims and no off-catalogue checkout", async () => {
    const html = await render("no_plan");
    expect(html).not.toContain("billing.authichain.com");
    expect(html).not.toMatch(/suspended|audit risk|data drops/i);
  });

  it("offers contact and current plans while the tier is unpriced", async () => {
    const html = await render();
    expect(html).toContain('href="/contact"');
    expect(html).toContain('href="/pricing"');
    expect(html).not.toContain("/checkout/enterprise_compliance");
  });
});
