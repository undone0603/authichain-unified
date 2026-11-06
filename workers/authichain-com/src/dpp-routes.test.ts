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
      expect(html).toContain("Check your workspace activation");
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
    expect(html).toContain("Check your workspace activation");
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
      expect(html).toContain("Check your workspace activation");
      expect(html).toContain("does not establish that payment succeeded");
      expect(html).not.toContain("50 workspace generations");
      expect(html).toContain("/dpp/activate?");
    }
  });

  it("names the right product and credits for a credit-bearing plan", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&visit_id=chk_1&plan=qron_launch")
    ))!.text();
    // The DPP workspace claim must not reach a non-DPP buyer.
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("50 workspace generations");
    expect(html).not.toContain("/dpp/activate?");
    expect(html).toContain("QRON Launch");
    expect(html).toContain("href=\"/generate\"");
    expect(html).not.toContain("paid=1");
  });

  it("does not confirm payment for an unknown plan", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_test_1&plan=not_a_real_plan")
    ))!.text();
    expect(html).toContain("Check your payment status");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("/dpp/activate?");
    expect(html).not.toContain("generations");
  });

  it("does not claim a paid purchase with an absent session", async () => {
    const html = await (await tryHandleDppRoute(req("/dpp/thanks")))!.text();
    expect(html).toContain("Payment not verified");
    expect(html).not.toContain("Workspace opened");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("/dpp/activate?session_id=");
    expect(html).toContain("/checkout/dpp_readiness");
  });

  it("does not claim payment for an unpaid but syntactically valid session", async () => {
    const html = await (await tryHandleDppRoute(
      req("/dpp/thanks?session_id=cs_live_unpaid123")
    ))!.text();
    expect(html).toContain("does not establish that payment succeeded");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("Workspace opened");
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

  it("rejects malformed session IDs before showing an activation form", async () => {
    const payload = "</script><script>window.pwned=1</script>";
    const res = tryHandleDppRoute(
      req("/dpp/activate?session_id=" + encodeURIComponent(payload))
    );
    const html = await res!.text();
    expect(html).toContain("Missing checkout session");
    expect(html).not.toContain("window.pwned=1");
    expect(html).not.toContain('id="f"');
  });

  it("escapes the visitor ID before including it in inline activation JavaScript", async () => {
    const payload = "</script><script>window.pwned=1</script>";
    const res = tryHandleDppRoute(
      req("/dpp/activate?session_id=cs_test_1&visit_id=" + encodeURIComponent(payload))
    );
    const html = await res!.text();
    expect(html).toContain("Activate your workspace");
    expect(html).not.toContain(payload);
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain("<script>window.pwned=1</script>");
  });

  it("returns null for unrelated paths", async () => {
    expect(await tryHandleDppRoute(req("/protocol"))).toBeNull();
  });
});
