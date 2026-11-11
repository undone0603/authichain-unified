import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SuccessPage from "./success/page";
import DppThanksPage from "./dpp/thanks/page";

describe("unverified checkout return pages", () => {
  it.each([
    ["QRON generic checkout", SuccessPage],
    ["DPP checkout", DppThanksPage],
  ])("%s never asserts a settled purchase or delivered asset", (_, Page) => {
    // Rendering without Stripe evidence must be safely neutral.
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toMatch(/cannot verify|not verified|unavailable/i);
    expect(html).not.toMatch(/ORDER ACTIVATED|Payment received|Workspace opened|Your payment added/i);
    expect(html).not.toMatch(/your dynamic redirect is now active|a confirmation email .* is on the way/i);
  });
});
