// @vitest-environment node
/** RES-81-XSS: /buy/thanks must never reflect an unvalidated session_id. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error -- plain JS Worker module
import worker from "./index.js";

function fakeKv() {
  const store = new Map<string, string>();
  store.set(
    "ledger",
    JSON.stringify({ updatedAt: "2026-10-17T15:00:00.000Z", receipts: [] })
  );
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
  };
}
async function thanks(sessionId: string, env: Record<string, unknown> = {}) {
  const kv = fakeKv();
  const url =
    "https://authichain.com/buy/thanks?session_id=" +
    encodeURIComponent(sessionId);
  const res = await worker.fetch(
    new Request(url, { headers: { accept: "text/html" } }),
    { LEDGER: kv, ...env }
  );
  return { res, html: await res.text(), kv };
}

describe("/buy/thanks XSS (RES-81)", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in test");
      })
    )
  );
  afterEach(() => vi.unstubAllGlobals());

  it("does not reflect an <img onerror> payload", async () => {
    const { res, html, kv } = await thanks(
      'cs_test_x"><img src=x onerror=alert(1)>'
    );
    expect(res.status).toBe(200);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("onerror=alert");
    expect(kv.store.get("stripe_session_queue") ?? "").not.toContain("onerror");
  });

  it("does not let a </script> payload break out of the inline script", async () => {
    const { html } = await thanks(
      "cs_test_a</script><script>alert(1)</script>"
    );
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("alert(1)");
  });

  it("still renders a valid cs_test_ id, escaped and JSON-safe", async () => {
    const id = "cs_test_a1B2c3D4";
    const { res, html } = await thanks(id);
    expect(res.status).toBe(200);
    expect(html).toContain("Your receipt is queued for the public ledger.");
    expect(html).not.toContain("Session <code>");
    expect(html).toContain(`const sessionId = "${id}";`);
    expect(html).toContain('id="ledger-live"');
  });

  it("Advisor: <script>/quote/</script> payload as session_id or ref is rejected, never raw in HTML or inline JSON", async () => {
    const payload = `cs_test_a"'</script><script>alert("x")</script>`;
    for (const param of ["session_id", "ref"]) {
      const kv = fakeKv();
      const url =
        "https://authichain.com/buy/thanks?" +
        param +
        "=" +
        encodeURIComponent(payload);
      const res = await worker.fetch(
        new Request(url, { headers: { accept: "text/html" } }),
        { LEDGER: kv }
      );
      const html = await res.text();
      expect(res.status).toBe(200);
      // Rejected: no inline session script is rendered for an invalid id.
      expect(html).not.toContain("<script");
      expect(html).not.toContain("</script><script>");
      expect(html).not.toContain('alert("x")');
      expect(html).not.toContain("const sessionId =");
      expect(kv.store.get("stripe_session_queue") ?? "").not.toContain(
        "script"
      );
    }
    // Valid ids reach the inline JSON only via the \u003c-escaping encoder: no raw "<" inside it.
    const { html } = await thanks("cs_test_a1B2c3D4");
    const inline = html.match(/const sessionId = (.*);/)?.[1] ?? "";
    expect(inline).toBe('"cs_test_a1B2c3D4"');
    expect(inline).not.toContain("<");
  });

  it("escapes Stripe lookup error text in the note", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: "<b>bad</b> key" } }),
            { status: 401 }
          )
      )
    );
    const { html } = await thanks("cs_test_a1B2c3D4", {
      STRIPE_SECRET_KEY: "sk_test_dummy",
    });
    expect(html).not.toContain("<b>bad</b>");
  });
});
