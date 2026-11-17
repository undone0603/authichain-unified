import { describe, expect, it } from "vitest";
import { tryHandleDppRoute } from "./dpp-routes";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.govchain.us${path}`, init);
}

describe("tryHandleDppRoute", () => {
  it("aliases /thanks and /success to an unverified checkout-return page", async () => {
    for (const path of [
      "/thanks?session_id=cs_test_1&visit_id=dpp_abc",
      "/success?session_id=cs_test_1&visit_id=dpp_abc",
    ]) {
      const res = await tryHandleDppRoute(req(path));
      expect(res).not.toBeNull();
      const html = await res!.text();
      expect(html).toContain("Checkout return");
      expect(html).not.toContain("Payment received");
      expect(html).toContain("Checkout status needs verification");
      expect(html).toContain('href="/generate"');
      expect(html).not.toContain("/dpp/activate?");
      expect(html).not.toContain("paid=1");
    }
  });

  it("does not mistake the live planless Starter Payment Link return for DPP", async () => {
    // Stripe Payment Link after_completion redirects only with session_id.
    for (const path of [
      "/success?session_id=cs_live_starter_example",
      "/thanks?session_id=cs_live_starter_example",
    ]) {
      const html = await (await tryHandleDppRoute(req(path)))!.text();
      expect(html).toContain("does not identify which product was purchased");
      expect(html).toContain('href="/generate"');
      expect(html).not.toContain("/dpp/activate?");
      expect(html).not.toContain("Workspace opened");
      expect(html).not.toContain("Payment received");
      expect(html).not.toContain("paid=1");
    }
    // DPP-specific return remains permitted to offer activation, but never
    // claims signed payment evidence or grants access on the return page.
    const dpp = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_dpp_example")
    ))!.text();
    expect(dpp).toContain("/dpp/activate?session_id=cs_dpp_example");
    expect(dpp).not.toContain("Workspace opened");
  });

  it("serves thanks HTML at the edge with the activate query string", async () => {
    const res = await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&visit_id=dpp_abc")
    );
    expect(res).not.toBeNull();
    expect(res!.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res!.text();
    expect(html).toContain("Checkout return");
    expect(html).not.toContain("Payment received");
    expect(html).toContain(
      "/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc"
    );
  });

  it("keeps the DPP copy when plan is absent or dpp_readiness", async () => {
    for (const path of [
      "/dpp/thanks?session_id=cs_test_1&visit_id=dpp_abc",
      "/dpp/thanks?session_id=cs_test_1&visit_id=dpp_abc&plan=dpp_readiness",
    ]) {
      const html = await (await tryHandleDppRoute(req(path)))!.text();
      expect(html).toContain("Verify before workspace activation");
      expect(html).toContain("Access requires a verified Stripe payment");
      expect(html).not.toContain("50 workspace generations");
      expect(html).toContain("/dpp/activate?");
    }
  });

  it("names the plan without claiming credit delivery on the return page", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&visit_id=chk_1&plan=qron_launch")
    ))!.text();
    // The DPP workspace claim must not reach a non-DPP buyer.
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("50 workspace generations");
    expect(html).not.toContain("/dpp/activate?");
    expect(html).toContain("generation balance");
    expect(html).not.toContain("100 generations");
    expect(html).toContain('href="/generate"');
    expect(html).not.toContain("paid=1");
    expect(html).not.toContain("session_id=cs_test_1");
  });

  it("does not confirm payment for an unknown plan", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&plan=not_a_real_plan")
    ))!.text();
    expect(html).toContain("Checkout return");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("/dpp/activate?");
    expect(html).not.toContain("generations");
  });

  it("never treats a forged session or plan as payment or a delivered credit grant", async () => {
    for (const path of [
      "/success?session_id=cs_fake&plan=starter",
      "/success?session_id=cs_fake&plan=creator",
      "/success?session_id=cs_fake&plan=dpp_readiness",
      "/success?session_id=cs_fake&plan=unknown",
      "/thanks?session_id=cs_fake",
    ]) {
      const res = await tryHandleDppRoute(req(path));
      const html = await res!.text();
      expect(html).not.toContain("Payment received");
      expect(html).not.toContain("Workspace opened");
      expect(html).not.toContain("is ready");
      expect(html).not.toContain("Your payment added");
      expect(html).not.toContain("checkout is confirmed");
      expect(html).not.toContain("paid=1");
    }
  });

  it("rejects implied payment when no session ID was supplied", async () => {
    for (const path of ["/thanks", "/success", "/dpp/thanks?plan=starter"]) {
      const res = await tryHandleDppRoute(req(path));
      const html = await res!.text();
      expect(html).toContain("No checkout reference provided");
      expect(html).not.toContain("Payment received");
      expect(html).not.toContain("Continue to activation");
      expect(html).not.toContain("/generate?paid=1");
    }
  });

  it("serves activate HTML that posts to /api/dpp/activate", async () => {
    const res = await tryHandleDppRoute(
      req("/dpp/activate?session_id=cs_test_1&visit_id=dpp_abc")
    );
    expect(res).not.toBeNull();
    const html = await res!.text();
    expect(html).toContain("fetch('/api/dpp/activate'");
    expect(html).toContain("cs_test_1");
    expect(html).toContain("Download field file (JSON)");
    expect(html).toContain("not a battery passport");
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
