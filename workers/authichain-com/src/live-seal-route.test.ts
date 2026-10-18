import { describe, expect, it } from "vitest";
import { tryHandleLiveSeal } from "./live-seal-route";

function req(path: string, method = "GET"): Request {
  return new Request(`https://authichain.com${path}`, { method });
}

describe("public Base mint on the apex", () => {
  it("leaves a product lookup alone", () => {
    expect(tryHandleLiveSeal(req("/verify/not-a-real-record"))).toBeNull();
    expect(tryHandleLiveSeal(req("/verify/manufacturer"))).toBeNull();
  });

  it("serves /verify/live and the trailing slash", async () => {
    for (const path of ["/verify/live", "/verify/live/"]) {
      const res = tryHandleLiveSeal(req(path));
      expect(res?.status).toBe(200);
      const html = await res!.text();
      expect(html).toContain("This seal is already on Base.");
      expect(html).toContain("authichain.base.eth");
      expect(html).toContain("0x34370EDA96e0C7e47f46F18e2D3a7298C241E16F");
      expect(html).toContain(
        "https://basescan.org/tx/0xa07d0bbadcc958b3f6fc8d81acda16a54c4bcfdb5e86bd2ce186e27f5752ab3b"
      );
      expect(html).toContain('href="/protocol"');
      expect(html).toContain('href="/checkout/starter"');
      expect(html).toContain("Buy Starter — $29");
      expect(html).toContain("a signed record is not an inspection");
      expect(html).not.toContain("Signature check");
      expect(html).not.toContain("$19");
      expect(html).not.toContain("qron_launch");
      expect(html).not.toContain('href="/pricing"');
    }
  });

  it("refuses other methods", async () => {
    const res = tryHandleLiveSeal(req("/verify/live", "POST"));
    expect(res?.status).toBe(405);
    expect(await res!.json()).toEqual({ error: "method_not_allowed" });
  });
});
