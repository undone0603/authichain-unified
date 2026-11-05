import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DppThanksPage from "./page";

const query = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query.value),
}));

function render(queryString: string): string {
  query.value = queryString;
  return renderToStaticMarkup(createElement(DppThanksPage));
}

describe("/dpp/thanks checkout redirect", () => {
  it("fails closed when there is no checkout reference", () => {
    const html = render("");
    expect(html).toContain("Checkout status unverified");
    expect(html).toContain("Back to DPP offer");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("Check activation eligibility");
  });

  it("does not trust a valid-looking session or spoofed plan", () => {
    const html = render(
      "?session_id=cs_live_A123&visit_id=dpp_abc&plan=starter"
    );
    expect(html).toContain("Checkout status unverified");
    expect(html).toContain("Check activation eligibility");
    expect(html).toContain("session_id=cs_live_A123");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("credits added");
  });

  it("rejects malformed session IDs", () => {
    const html = render("?session_id=cs_live_%22");
    expect(html).toContain("Back to DPP offer");
    expect(html).not.toContain("/dpp/activate?");
  });
});
