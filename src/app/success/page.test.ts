import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SuccessPage from "./page";

describe("/success checkout redirect", () => {
  it("never represents a redirect as payment or fulfillment proof", () => {
    const html = renderToStaticMarkup(SuccessPage());
    expect(html).toContain("Checkout status unverified");
    expect(html).toContain("We cannot confirm payment here");
    expect(html).not.toContain("ORDER ACTIVATED");
    expect(html).not.toContain("Protocol Handshake Successful");
    expect(html).not.toContain("Verified ◆ Success");
    expect(html).not.toContain("Your dynamic redirect is now active");
    expect(html).toContain('href="/dashboard"');
  });
});
