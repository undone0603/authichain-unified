import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/checkout", () => {
  it("routes paid plans through the click-to-confirm checkout", async () => {
    const request = new Request("https://qron.space/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "aff_ref=AFF-COOKIE",
      },
      body: JSON.stringify({
        planId: "starter",
        email: "buyer@example.com",
        prospectId: "visit-1",
        source: "affiliate",
      }),
    });
    const response = await POST(request);
    const body = (await response.json()) as { url: string };
    const url = new URL(body.url);

    expect(response.status).toBe(200);
    expect(url.origin).toBe("https://authichain.com");
    expect(url.pathname).toBe("/checkout/starter");
    expect(url.searchParams.get("email")).toBe("buyer@example.com");
    expect(url.searchParams.get("affiliate_code")).toBe("AFF-COOKIE");
    expect(url.searchParams.get("prospect_id")).toBe("visit-1");
    expect(url.searchParams.get("source")).toBe("affiliate");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects unknown and free plans", async () => {
    for (const planId of ["missing", "free"]) {
      const response = await POST(
        new Request("https://authichain.com/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId }),
        })
      );
      expect(response.status).toBe(400);
    }
  });
});
