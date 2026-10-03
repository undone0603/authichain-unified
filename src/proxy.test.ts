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
});
