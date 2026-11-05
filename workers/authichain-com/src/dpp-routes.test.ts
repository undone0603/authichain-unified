import { describe, expect, it } from "vitest";
import { tryHandleDppRoute } from "./dpp-routes";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.govchain.us${path}`, init);
}

describe("tryHandleDppRoute", () => {
  it.each([
    "/thanks",
    "/success",
    "/dpp/thanks",
    "/success?session_id=fake",
    "/dpp/thanks?session_id=cs_live_",
  ])("does not claim payment or offer activation without a valid reference: %s", async path => {
    const response = tryHandleDppRoute(req(path));
    expect(response).not.toBeNull();
    const html = await response!.text();
    expect(response!.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain("Checkout status unverified");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("Your payment added");
    expect(html).not.toContain("/dpp/activate?");
  });

  it.each([
    "/thanks?session_id=cs_test_1&visit_id=dpp_abc",
    "/success?session_id=cs_test_1&visit_id=dpp_abc",
    "/dpp/thanks?session_id=cs_live_ABC&visit_id=dpp_abc",
  ])("treats plausible sessions as unverified, not paid: %s", async path => {
    const html = await (await tryHandleDppRoute(req(path)))!.text();
    expect(html).toContain("Checkout status unverified");
    expect(html).toContain("Check activation eligibility");
    expect(html).toContain("session_id=cs_");
    expect(html).toContain("visit_id=dpp_abc");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("A confirmation email is also on the way");
  });

  it("ignores spoofed plan claims and cannot issue paid generation copy", async () => {
    for (const plan of ["qron_launch", "starter", "dpp_readiness", "not_a_real_plan"]) {
      const html = await (await tryHandleDppRoute(
        req(`/dpp/thanks?session_id=cs_test_1&plan=${plan}`)
      ))!.text();
      expect(html).toContain("Checkout status unverified");
      expect(html).not.toContain("generations to this account");
      expect(html).not.toContain("/generate?paid=1");
      expect(html).not.toContain("Workspace opened");
      expect(html).not.toContain("Payment received");
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

  it("never embeds untrusted activation query values into inline JavaScript", async () => {
    const raw = "</script><script>globalThis.pwned=true</script>";
    const encoded = encodeURIComponent(raw);
    const invalidSession = await (
      await tryHandleDppRoute(req(`/dpp/activate?session_id=${encoded}`))
    )!.text();
    expect(invalidSession).toContain("Missing checkout session");
    expect(invalidSession).not.toContain("<script>globalThis.pwned");

    const validSession = await (
      await tryHandleDppRoute(
        req(`/dpp/activate?session_id=cs_live_ABC&visit_id=${encoded}`)
      )
    )!.text();
    expect(validSession).toContain("Activate your workspace");
    expect(validSession).not.toContain("<script>globalThis.pwned");
    expect(validSession).not.toContain(raw);
    expect(validSession).toContain('session_id: "cs_live_ABC"');
    expect(validSession).toContain('visit_id: ""');
  });

  it("requires a Stripe-shaped session ID for activation rendering", async () => {
    const invalid = await (
      await tryHandleDppRoute(req("/dpp/activate?session_id=not-a-stripe-session"))
    )!.text();
    expect(invalid).toContain("Missing checkout session");
    expect(invalid).not.toContain("fetch('/api/dpp/activate'");
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
