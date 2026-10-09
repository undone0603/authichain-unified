import { describe, expect, it } from "vitest";
import { tryHandleDppRoute } from "./dpp-routes";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.govchain.us${path}`, init);
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
      expect(html).toContain("use the link in your confirmation email");
    }
  });

  it("serves thanks HTML at the edge, pointing to the emailed link", async () => {
    const res = await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&visit_id=dpp_abc")
    );
    expect(res).not.toBeNull();
    expect(res!.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res!.text();
    expect(html).toContain("Payment received");
    expect(html).toContain("use the link in your confirmation email");
  });

  it("keeps the DPP copy when plan is absent or dpp_readiness", async () => {
    for (const path of [
      "/dpp/thanks?session_id=cs_test_1&visit_id=dpp_abc",
      "/dpp/thanks?session_id=cs_test_1&visit_id=dpp_abc&plan=dpp_readiness",
    ]) {
      const html = await (await tryHandleDppRoute(req(path)))!.text();
      expect(html).toContain(
        "Thanks. This confirms your $299 payment. Next, use the link in your confirmation email to fill in the short onboarding form. The readiness work itself is in development."
      );
      expect(html).toContain(
        "Prefer a refund? Email support@authichain.com and we'll refund the full $299 to your original payment method."
      );
      expect(html).not.toMatch(/workspace is ready/i);
      expect(html).not.toMatch(/50 (workspace )?generations/i);
      expect(html).not.toMatch(/AuthiChain workspace/i);
      expect(html).not.toMatch(/Workspace opened/i);
      expect(html).not.toMatch(/email you before anything is delivered/i);
      expect(html).not.toMatch(/reply to your confirmation email/i);
      expect(html).not.toMatch(/onboarding form below/i);
    }
  });

  it("serves activate HTML with no workspace or generations claim (ADM-180)", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc")
    ))!.text();
    expect(html).toContain("Onboarding form");
    expect(html).toContain("The readiness work is in development.");
    expect(html).not.toMatch(/workspace is ready/i);
    expect(html).not.toMatch(/50 (workspace )?generations/i);
    expect(html).not.toMatch(/AuthiChain workspace/i);
  });

  it("names the right product and credits for a credit-bearing plan", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&visit_id=chk_1&plan=qron_launch")
    ))!.text();
    // The DPP workspace claim must not reach a non-DPP buyer.
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("50 workspace generations");
    expect(html).not.toContain("/dpp/activate?");
    expect(html).toContain("100 generations");
    expect(html).toContain("/generate?paid=1");
    expect(html).toContain("session_id=cs_test_1");
  });

  it("confirms payment without claiming a product for an unknown plan", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&plan=not_a_real_plan")
    ))!.text();
    expect(html).toContain("Payment received");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("/dpp/activate?");
    expect(html).not.toContain("generations");
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
      req("https://authichain.com/checkout/dpp_readiness?visit_id=dpp_abc")
    );
    const activate = await tryHandleDppRoute(
      new Request("https://authichain.govchain.us/api/dpp/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: "cs_test_1" }),
      })
    );
    const webhook = await tryHandleDppRoute(
      new Request("https://authichain.govchain.us/api/stripe/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"type":"checkout.session.completed"}',
      })
    );
    const funnel = await tryHandleDppRoute(
      new Request("https://authichain.govchain.us/api/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: "dpp_abc",
          stage: "visit_landing_page",
        }),
      })
    );
    const publish = await tryHandleDppRoute(
      new Request("https://authichain.govchain.us/api/dpp/publish", {
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
