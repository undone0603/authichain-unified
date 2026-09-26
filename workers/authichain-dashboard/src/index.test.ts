import { afterEach, describe, expect, it, vi } from "vitest";
import worker, {
  ago,
  esc,
  joinLoops,
  maskEmail,
  renderPage,
  summarizeMoney,
  usd,
} from "./index";

describe("command center helpers", () => {
  it("escapes html and masks emails", () => {
    expect(esc(`<a href="x">'&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;"
    );
    expect(maskEmail("sales@ironfish.com")).toBe("s***@ironfish.com");
    expect(maskEmail(null)).toBe("—");
    expect(usd(4900)).toBe("$49.00");
    expect(ago(Date.now() - 3 * 3600_000)).toBe("3h ago");
  });

  it("separates customer revenue from founder self-tests and computes MRR", () => {
    const charges = [
      {
        status: "succeeded",
        paid: true,
        refunded: false,
        amount: 1000,
        currency: "usd",
        created: 1,
        billing_details: { email: "Founder@x.com" },
      },
      {
        status: "succeeded",
        paid: true,
        refunded: false,
        amount: 4900,
        currency: "usd",
        created: 2,
        billing_details: { email: "buyer@farm.com" },
      },
      {
        status: "failed",
        paid: false,
        amount: 29900,
        currency: "usd",
        created: 3,
        billing_details: { email: "buyer@farm.com" },
      },
    ];
    const subs = [
      {
        items: {
          data: [
            {
              quantity: 1,
              price: {
                currency: "usd",
                unit_amount: 14900,
                recurring: { interval: "month", interval_count: 1 },
              },
            },
          ],
        },
      },
    ];
    const sessions = [
      { status: "open" },
      { status: "expired", payment_status: "unpaid" },
      { status: "complete", payment_status: "paid" },
    ];
    const m = summarizeMoney(
      charges,
      { available: [{ currency: "usd", amount: 931 }], pending: [] },
      subs,
      sessions,
      ["founder@x.com"]
    );
    expect(m.external30d).toBe(4900);
    expect(m.externalCount30d).toBe(1);
    expect(m.founderTests30d).toBe(1);
    expect(m.mrr).toBe(14900);
    expect(m.openCheckouts7d).toBe(2);
    expect(m.available).toBe(931);
  });

  it("joins manifest, workflow state and latest run; skips ship and manual lanes", () => {
    const manifest = {
      lanes: {
        ship: { managed: true, workflows: { "ci.yml": "on" } },
        health: { managed: true, workflows: { "ops-pulse.yml": "on" } },
        manual: { managed: false, workflows: { "x.yml": "manual" } },
      },
    };
    const rows = joinLoops(
      manifest,
      [{ path: ".github/workflows/ops-pulse.yml", state: "active" }],
      [
        { path: ".github/workflows/ops-pulse.yml", status: "in_progress" },
        {
          path: ".github/workflows/ops-pulse.yml",
          status: "completed",
          conclusion: "success",
          updated_at: "2026-09-23T12:00:00Z",
          html_url: "u",
        },
      ]
    );
    expect(rows).toEqual([
      {
        file: "ops-pulse.yml",
        lane: "health",
        desired: "on",
        state: "active",
        conclusion: "success",
        at: "2026-09-23T12:00:00Z",
        url: "u",
      },
    ]);
  });
});

describe("command center page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders not-connected states instead of numbers when secrets are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const html = await renderPage({ ACCESS_TOKEN: "t" });
    expect(html).toContain("Set the STRIPE_READ_KEY secret");
    expect(html).toContain("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    expect(html).not.toMatch(/Lion Labs|Sotheby/);
  });

  it("requires the session cookie", async () => {
    const res = await worker.fetch(
      new Request("https://dashboard.authichain.com/"),
      { ACCESS_TOKEN: "secret" }
    );
    expect(res.status).toBe(401);
    const login = await worker.fetch(
      new Request("https://dashboard.authichain.com/login", {
        method: "POST",
        body: new URLSearchParams({ k: "secret" }),
      }),
      { ACCESS_TOKEN: "secret" }
    );
    expect(login.status).toBe(303);
    expect(login.headers.get("Set-Cookie")).toContain("HttpOnly");
  });
});
