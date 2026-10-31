import { describe, expect, it } from "vitest";
import {
  isIsThisRealPath,
  renderIsThisRealPage,
  IS_THIS_REAL_SOURCE,
} from "./is-this-real-page";

describe("/is-this-real", () => {
  const html = renderIsThisRealPage();
  it("matches only its path", () => {
    expect(isIsThisRealPath("/is-this-real")).toBe(true);
    expect(isIsThisRealPath("/is-this-real/")).toBe(true);
    expect(isIsThisRealPath("/is-this")).toBe(false);
  });
  it("has seal, an optional email, an optional 2-letter country, and an unchecked, optional consent box", () => {
    expect(html).toContain('name="sealId"');
    expect(html).toMatch(
      /<input type="email" id="email"(?![^>]*required)[^>]*>/
    );
    expect(html).toMatch(
      /name="country" maxlength="2" pattern="\[A-Za-z\]\{2\}"/
    );
    expect(html).toContain("country:f.country.value.trim().toUpperCase()");
    expect(html).toMatch(
      /<input type="checkbox" id="consent"(?![^>]*(required|checked))[^>]*>/
    );
    expect(html).toContain('href="/privacy"');
  });
  it("runs the check without an email and only opts in with email + consent", () => {
    expect(html).toContain(
      'if(!seal){st.textContent="Enter a seal ID.";return}'
    );
    expect(html).toContain("if(!captured&&email&&f.consent.checked)");
    expect(html).toContain("/api/email-optin");
  });
  it("keeps the existing lead capture POST, unchanged, when email + consent are given", () => {
    expect(html).toContain('fetch("/api/leads/capture"');
    expect(html).toContain(
      `source:"${IS_THIS_REAL_SOURCE}",product_interest:"nickel-verify"`
    );
    expect(html).toContain(
      'message:"consent: yes; first seal: "+seal.slice(0,128),page_url:location.href'
    );
    expect(html.indexOf("/api/leads/capture")).toBeGreaterThan(
      html.indexOf("if(!captured&&email&&f.consent.checked)")
    );
  });
  it("offers 3 free checks then a price-free x402 option", () => {
    expect(html).toContain("MAX=3");
    expect(html).toContain("an unpaid call returns HTTP 402 with the price");
    expect(html).toContain("not a paid receipt");
    expect(html).toContain("daily free allowance");
    expect(html).toContain("A non-UUID sealId is HTTP 400 before payment");
    expect(html).not.toContain('{"sealId":"..."}');
    expect(html).not.toContain('{"sealId":"demo"}');
    expect(html).not.toMatch(/\$0\.05|5 cents|5&cent;|¢|USDC/);
    expect(html).toContain("/api/v1/agent-verify");
  });
  it("names the demonstration example without a product claim", () => {
    expect(html).toContain("polygon-anchor-1");
    expect(html).toContain("published demonstration record, not a product");
    expect(html).toContain("not a physical inspection");
    expect(html).toContain("does not itself read the anchor transaction");
    expect(html).not.toContain("printed on an AuthiChain-sealed product");
    expect(html).not.toContain("polygonscan.com");
    expect(html).not.toContain('{"sealId":"demo"}');
  });
  it("makes no live, customer or metric claims", () => {
    const text = html
      .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "")
      .replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\blive\b|customers|trusted by|\d+%/i);
  });
});
