import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("proxy", () => {
  it("does not decide compliance access from a client-set cookie", () => {
    // The old gate let anyone through who set org_plan_tier themselves, and
    // redirected everyone else. Access is now decided on the server.
    for (const cookie of ["org_plan_tier=enterprise_compliance", ""]) {
      const res = proxy(
        new NextRequest("https://authichain.com/dashboard/compliance", {
          headers: cookie ? { cookie } : {},
        })
      );
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("still tags the brand from the Host header", () => {
    const res = proxy(
      new NextRequest("https://qron.space/pricing", {
        headers: { host: "qron.space" },
      })
    );
    expect(res.headers.get("x-brand")).toBe("qron");
  });

  it.each([
    ["authichain.com", "/", "/authichain", "authichain"],
    ["authichain.com", "/pricing", "/authichain/pricing", "authichain"],
    ["strainchain.io", "/", "/digital-product-passport", "strainchain"],
    ["strainchain.io", "/pricing", "/digital-product-passport/pricing", "strainchain"],
  ])("preserves query parameters when rewriting %s%s", (host, path, expectedPath, brand) => {
    const url = new URL(`https://${host}${path}?ref=partner_42&utm_source=email&tag=one&tag=two&return=%2Fdashboard%3Ftab%3Dproof`);
    const res = proxy(new NextRequest(url, { headers: { host } }));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).not.toBeNull();
    const destination = new URL(rewrite!);
    expect(destination.origin).toBe(url.origin);
    expect(destination.pathname).toBe(expectedPath);
    expect(destination.search).toBe(url.search);
    expect(destination.searchParams.getAll("tag")).toEqual(["one", "two"]);
    expect(res.headers.get("x-brand")).toBe(brand);
    expect(res.headers.get("x-middleware-request-x-brand")).toBe(brand);
  });

  it.each(["authichain.com", "strainchain.io"])(
    "sets affiliate attribution on the actual rewrite response for %s",
    (host) => {
      const res = proxy(new NextRequest(`https://${host}/?ref=partner_42`, { headers: { host } }));
      expect(res.headers.get("x-middleware-rewrite")).not.toBeNull();
      expect(res.cookies.get("aff_ref")?.value).toBe("partner_42");
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("Max-Age=2592000");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=lax");
    }
  );

  it.each([
    ["authichain.com", "/dashboard"],
    ["authichain.com", "/api/verify"],
    ["authichain.com", "/authichain/pricing"],
    ["qron.space", "/pricing"],
  ])("retains attribution without rewriting %s%s", (host, path) => {
    const res = proxy(new NextRequest(`https://${host}${path}?ref=partner_42`, { headers: { host } }));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.cookies.get("aff_ref")?.value).toBe("partner_42");
  });

  it.each(["", "bad/code", "a".repeat(65)])(
    "does not set an affiliate cookie for invalid attribution %j",
    (ref) => {
      const url = new URL("https://authichain.com/");
      url.searchParams.set("ref", ref);
      const res = proxy(new NextRequest(url, { headers: { host: "authichain.com" } }));
      expect(res.headers.get("x-middleware-rewrite")).not.toBeNull();
      expect(res.cookies.get("aff_ref")).toBeUndefined();
    }
  );
});
