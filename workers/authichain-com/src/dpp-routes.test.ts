import { describe, expect, it } from "vitest";
import { tryHandleDppRoute } from "./dpp-routes";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.com${path}`, init);
}

describe("tryHandleDppRoute", () => {
  it("aliases /thanks and /success to the DPP thanks page", async () => {
    for (const path of [
      "/thanks?session_id=cs_test_1&visit_id=dpp_abc",
      "/success?session_id=cs_test_1&visit_id=dpp_abc",
    ]) {
      const res = await tryHandleDppRoute(req(path));
      expect(res).not.toBeNull();
      const html = await res!.text();
      expect(html).toContain("Payment received");
      expect(html).toContain(
        "/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc"
      );
    }
  });

  it("serves thanks HTML at the edge with the activate query string", async () => {
    const res = await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&visit_id=dpp_abc")
    );
    expect(res).not.toBeNull();
    expect(res!.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res!.text();
    expect(html).toContain("Payment received");
    expect(html).toContain(
      "/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc"
    );
  });

  it("serves activate HTML that posts to /api/dpp/activate", async () => {
    const res = await tryHandleDppRoute(
      req("/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc")
    );
    expect(res).not.toBeNull();
    const html = await res!.text();
    expect(html).toContain("fetch('/api/dpp/activate'");
    expect(html).toContain("cs_test_1");
  });

  it("serves a missing-session page for /dpp/activate without session_id", async () => {
    const res = await tryHandleDppRoute(req("/dpp/activate"));
    expect(res).not.toBeNull();
    expect(await res!.text()).toContain("Missing checkout session");
  });

  it("returns null for DPP money APIs so APP_PREFIXES proxy them", async () => {
    const checkout = await tryHandleDppRoute(
      req("/api/checkout/dpp?visit_id=dpp_abc")
    );
    const activate = await tryHandleDppRoute(
      new Request("https://authichain.com/api/dpp/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: "cs_test_1" }),
      })
    );
    const webhook = await tryHandleDppRoute(
      new Request("https://authichain.com/api/stripe/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"type":"checkout.session.completed"}',
      })
    );
    const funnel = await tryHandleDppRoute(
      new Request("https://authichain.com/api/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: "dpp_abc",
          stage: "visit_landing_page",
        }),
      })
    );
    const publish = await tryHandleDppRoute(
      new Request("https://authichain.com/api/dpp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit_id: "dpp_abc", name: "Widget" }),
      })
    );
    const verify = await tryHandleDppRoute(
      req("/api/dpp/verify?dpp_id=prod_1&visit_id=dpp_abc")
    );
    expect(checkout).toBeNull();
    expect(activate).toBeNull();
    expect(publish).toBeNull();
    expect(verify).toBeNull();
    expect(webhook).toBeNull();
    expect(funnel).toBeNull();
  });

  it("returns null for /dpp marketing so index.ts keeps serving it", async () => {
    expect(await tryHandleDppRoute(req("/dpp"))).toBeNull();
  });

  it("returns null for unrelated paths", async () => {
    expect(await tryHandleDppRoute(req("/protocol"))).toBeNull();
  });
});
