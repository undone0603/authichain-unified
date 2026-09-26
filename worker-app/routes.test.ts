import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/webhooks/stripe", () => ({
  handleStripeWebhook: vi.fn().mockResolvedValue({ received: true }),
}));

vi.mock("../server/paddle/webhook", () => ({
  handlePaddleWebhook: vi
    .fn()
    .mockImplementation(async (_db: unknown, _req: unknown, res: any) => {
      res.json({ received: true });
    }),
}));

vi.mock("../server/webhooks/instantly", () => ({
  handleInstantlyWebhook: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../server/webhooks/docusign", () => ({
  handleDocuSignWebhook: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../server/db", () => ({
  getHyperdriveDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("../server/_core/db-helpers", () => ({
  getOpsSummary: vi.fn().mockResolvedValue({ ok: true }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

const indexModule = await import("./index");
const app = indexModule.app;
const __resetMarketingRoutesCache = indexModule.__resetMarketingRoutesCache;

const { dppCreate } = vi.hoisted(() => ({ dppCreate: vi.fn() }));
vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = {
      sessions: { create: (...args: unknown[]) => dppCreate(...args) },
    };
  },
}));

describe("GET /api/checkout/dpp", () => {
  beforeEach(() => {
    dppCreate.mockReset();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("HEAD does not create a Stripe session", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dpp";
    const res = await app.request("/api/checkout/dpp", { method: "HEAD" });
    expect(res.status).toBe(204);
    expect(dppCreate).not.toHaveBeenCalled();
  });

  it("GET with email 303s to the confirm page and never calls Stripe", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dpp";
    const res = await app.request(
      "/api/checkout/dpp?visit_id=dpp_worker_1&utm_source=seo&email=ops%40brand.com"
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://authichain.com/checkout/dpp_readiness?email=ops%40brand.com&visit_id=dpp_worker_1&utm_source=seo"
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(dppCreate).not.toHaveBeenCalled();
  });

  it("GET without email 303s to the confirm page", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dpp";
    const res = await app.request("/api/checkout/dpp?visit_id=dpp_worker_anon");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://authichain.com/checkout/dpp_readiness?visit_id=dpp_worker_anon"
    );
    expect(dppCreate).not.toHaveBeenCalled();
  });

  it("DPP-SMOKE-E2E still creates the $0 demo session on GET", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dpp";
    dppCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_smoke",
    });
    const res = await app.request(
      "/api/checkout/dpp?visit_id=dpp_smoke&promo=DPP-SMOKE-E2E"
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test_smoke"
    );
    expect(dppCreate).toHaveBeenCalledOnce();
  });
});

describe("GET /api/checkout/plan/:planId", () => {
  beforeEach(() => {
    dppCreate.mockReset();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("HEAD does not create a Stripe session", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_plan";
    const res = await app.request("/api/checkout/plan/strainchain_passport", {
      method: "HEAD",
    });
    expect(res.status).toBe(204);
    expect(dppCreate).not.toHaveBeenCalled();
  });

  it("GET (with or without email) 303s to the confirm page, never Stripe", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_plan";
    const bare = await app.request("/api/checkout/plan/strainchain_passport");
    expect(bare.status).toBe(303);
    expect(bare.headers.get("location")).toBe(
      "https://authichain.com/checkout/strainchain_passport"
    );
    const withEmail = await app.request(
      "/api/checkout/plan/strainchain_passport?utm_source=pricing&email=ops%40brand.com"
    );
    expect(withEmail.status).toBe(303);
    expect(withEmail.headers.get("location")).toBe(
      "https://authichain.com/checkout/strainchain_passport?email=ops%40brand.com&utm_source=pricing"
    );
    const unknown = await app.request("/api/checkout/plan/nope");
    expect(unknown.headers.get("location")).toBe("https://authichain.com/checkout");
    expect(dppCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/checkout", () => {
  it("returns route health JSON and does not create a Stripe session", async () => {
    const res = await app.request("/api/checkout");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.smoke).toBe("GET /api/checkout/dpp?promo=DPP-SMOKE-E2E");
    expect(body.webhook).toBe("POST /api/stripe/webhook");
  });
});

describe("POST /api/checkout", () => {
  it("403s an automated (no UA / bot UA / prefetch) POST", async () => {
    for (const headers of [
      { "content-type": "application/json" },
      { "content-type": "application/json", "user-agent": "Googlebot/2.1" },
      {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
        "sec-purpose": "prefetch",
      },
    ]) {
      const res = await app.request("/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({ planId: "creator" }),
      });
      expect(res.status).toBe(403);
    }
  });

  it("returns 400 without planId", async () => {
    const res = await app.request("/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/planId/);
  });
});

describe("GET /api/generate", () => {
  it("returns health JSON instead of a 404", async () => {
    const res = await app.request("/api/generate");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.methods).toContain("POST");
    expect(body.auth).toBe(false);
    expect(body.packs.some((p: { price: number }) => p.price === 29)).toBe(
      true
    );
  });
});

describe("POST /api/generate", () => {
  it("returns JSON 401 with credit packs when unauthenticated, not a plain-text 404", async () => {
    const res = await app.request("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetUrl: "https://example.com",
        prompt: "neon",
      }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.message).toMatch(/Authentication required/i);
    expect(Array.isArray(body.packs)).toBe(true);
  });
});

describe("GET /api/stripe/webhook", () => {
  it("reports the handler is present without requiring a signature", async () => {
    const res = await app.request("/api/stripe/webhook");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.handler).toBe("present");
  });
});

describe("POST /api/webhooks/stripe", () => {
  it("aliases to the canonical webhook handler", async () => {
    const res = await app.request("/api/webhooks/stripe", {
      method: "POST",
      body: "raw-stripe-payload",
      headers: { "stripe-signature": "t=123,v1=fake" },
    });
    expect(res.status).toBe(200);
    const { handleStripeWebhook } = await import("../server/webhooks/stripe");
    expect(handleStripeWebhook).toHaveBeenCalled();
  });
});

describe("app host /", () => {
  it("302s app.authichain.com/ to /dashboard", async () => {
    const res = await app.request("/", {
      headers: { host: "app.authichain.com" },
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/dashboard");
  });
});

describe("POST /api/stripe/webhook", () => {
  it("passes the raw body and signature header through unchanged", async () => {
    const res = await app.request("/api/stripe/webhook", {
      method: "POST",
      body: "raw-stripe-payload",
      headers: { "stripe-signature": "t=123,v1=fake" },
    });
    expect(res.status).toBe(200);
    const { handleStripeWebhook } = await import("../server/webhooks/stripe");
    expect(handleStripeWebhook).toHaveBeenCalled();
    const args = (handleStripeWebhook as any).mock.calls[0];
    expect(Buffer.from(args[0]).toString()).toBe("raw-stripe-payload");
    expect(args[1]).toBe("t=123,v1=fake");
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await app.request("/api/stripe/webhook", {
      method: "POST",
      body: "raw-stripe-payload",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/stripe-signature/i);
  });
});

describe("POST /api/funnel", () => {
  it("returns 400 JSON when required fields are missing", async () => {
    const res = await app.request("/api/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: "visit_landing_page" }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = await res.json();
    expect(body.error).toMatch(/prospect_id/);
  });

  it("returns 500 JSON when Supabase is not configured", async () => {
    const res = await app.request("/api/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prospect_id: "dpp_worker_1",
        stage: "visit_landing_page",
        source: "seo",
        event_type: "dpp_loop:attributed_visit",
      }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });
});

describe("POST /api/dpp/activate", () => {
  it("returns 400 JSON without session_id", async () => {
    const res = await app.request("/api/dpp/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categories: "sku",
        markets: "EU",
        labeling: "none",
      }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = await res.json();
    expect(body.error).toMatch(/session_id/);
  });
});

describe("POST /api/dpp/publish", () => {
  it("returns 400 JSON without visit_id", async () => {
    const res = await app.request("/api/dpp/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Widget" }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = await res.json();
    expect(body.error).toMatch(/visit_id/);
  });

  it("returns 500 JSON when Supabase is not configured", async () => {
    const res = await app.request("/api/dpp/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visit_id: "dpp_1", name: "Widget" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });
});

describe("GET /api/dpp/verify", () => {
  it("returns 400 JSON without dpp_id", async () => {
    const res = await app.request("/api/dpp/verify");
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = await res.json();
    expect(body.error).toMatch(/dpp_id/);
  });

  it("returns 500 JSON when Supabase is not configured", async () => {
    const res = await app.request("/api/dpp/verify?dpp_id=prod_1");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });
});

describe("GET /api/cron/dpp-exceptions", () => {
  it("returns 401 JSON without a bearer token, never HTML", async () => {
    const res = await app.request("/api/cron/dpp-exceptions");
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    expect(res.headers.get("content-type") ?? "").toMatch(/json/i);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/i);
  });
});

describe("GET /api/automation/cron", () => {
  it("returns 401 JSON without a bearer token, never HTML", async () => {
    const res = await app.request("/api/automation/cron");
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    expect(res.headers.get("content-type") ?? "").toMatch(/json/i);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/i);
  });
});

describe("POST /api/v1/attestation", () => {
  it("returns JSON (not HTML) when the signing key is missing", async () => {
    const res = await app.request("/api/v1/attestation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: "0.1" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers.get("content-type") ?? "").toMatch(/json/i);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

describe("POST /api/paddle/webhook", () => {
  it("shims a req/res pair for the Express-shaped handler and returns its response", async () => {
    const res = await app.request("/api/paddle/webhook", {
      method: "POST",
      body: "raw-paddle-payload",
      headers: { "paddle-signature": "fake-sig" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });
    const { handlePaddleWebhook } = await import("../server/paddle/webhook");
    const args = (handlePaddleWebhook as any).mock.calls.at(-1);
    expect(args[1].headers["paddle-signature"]).toBe("fake-sig");
    expect(args[1].body.toString()).toBe("raw-paddle-payload");
  });

  it("returns 400 when the paddle-signature header is missing", async () => {
    const res = await app.request("/api/paddle/webhook", {
      method: "POST",
      body: "x",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/webhooks/instantly", () => {
  it("forwards the parsed JSON payload to the handler", async () => {
    const res = await app.request("/api/webhooks/instantly", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "email_opened", email: "a@b.com" }),
    });
    expect(res.status).toBe(200);
    const { handleInstantlyWebhook } =
      await import("../server/webhooks/instantly");
    const args = (handleInstantlyWebhook as any).mock.calls.at(-1);
    expect(args[1]).toEqual({ event: "email_opened", email: "a@b.com" });
  });
});

describe("POST /api/webhooks/docusign", () => {
  it("forwards the parsed JSON payload to the handler", async () => {
    const res = await app.request("/api/webhooks/docusign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "envelope-sent",
        recipientEmail: "a@b.com",
      }),
    });
    expect(res.status).toBe(200);
    const { handleDocuSignWebhook } =
      await import("../server/webhooks/docusign");
    const args = (handleDocuSignWebhook as any).mock.calls.at(-1);
    expect(args[1]).toEqual({
      event: "envelope-sent",
      recipientEmail: "a@b.com",
    });
  });
});

describe("GET /api/admin/ops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    const { sdk } = await import("../server/_core/sdk");
    (sdk.authenticateRequest as any).mockRejectedValueOnce(
      new Error("no session")
    );
    const res = await app.request("/api/admin/ops");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the signed-in user is not an admin", async () => {
    const { sdk } = await import("../server/_core/sdk");
    (sdk.authenticateRequest as any).mockResolvedValueOnce({ role: "user" });
    const res = await app.request("/api/admin/ops");
    expect(res.status).toBe(403);
  });

  it("returns the ops summary for an admin user", async () => {
    const { sdk } = await import("../server/_core/sdk");
    (sdk.authenticateRequest as any).mockResolvedValueOnce({ role: "admin" });
    const res = await app.request("/api/admin/ops");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

describe("GET /api/oauth/callback", () => {
  it("returns 400 when code or state is missing", async () => {
    const res = await app.request("/api/oauth/callback");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/code and state/i);
  });
});

describe("POST /api/contact", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await app.request("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email address", async () => {
    const res = await app.request("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Zac",
        email: "not-an-email",
        message: "hi",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("succeeds without attempting SMTP when unconfigured", async () => {
    const res = await app.request("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Zac",
        email: "zac@example.com",
        message: "hi",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("GPT plugin routes", () => {
  it("POST /api/gpt/verify returns 400 without a productId", async () => {
    const res = await app.request("/api/gpt/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/gpt/certificates/verify returns 400 without certNumber", async () => {
    const res = await app.request("/api/gpt/certificates/verify");
    expect(res.status).toBe(400);
  });
});

describe("Internal gateway API auth guard", () => {
  it("returns 401 when X-Internal-Secret is missing", async () => {
    const res = await app.request("/api/internal/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an incorrect X-Internal-Secret", async () => {
    const res = await app.request("/api/internal/tenant", {
      headers: { "x-internal-secret": "definitely-wrong" },
    });
    expect(res.status).toBe(401);
  });
});

// __STATIC_ROUTING_TESTS__
// Task 3.2: manifest-driven static + SPA routing in the "*" fallback handler.
// The Hono app runs OUTSIDE workerd here (no real ASSETS binding), so we pass a
// mock env as the 3rd arg to app.request(). The mock ASSETS.fetch returns a
// Response keyed on the requested URL pathname, letting us assert exactly which
// asset the worker chose to fetch for each route.
describe("manifest-driven static + SPA routing", () => {
  const MARKETING_ROUTES = ["/about", "/pricing", "/admin", "/contact"];

  function makeEnv() {
    return {
      ASSETS: {
        fetch: async (input: Request | string) => {
          const url = new URL(typeof input === "string" ? input : input.url);
          const p = url.pathname;
          if (p === "/marketing-manifest.json") {
            // NOTE: deliberately lists /admin as a marketing route to prove the
            // D1 override — resolveOwner must still return "spa" for /admin
            // because SPA_OWNED_PREFIXES is checked before the marketing set.
            return new Response(JSON.stringify({ routes: MARKETING_ROUTES }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (p === "/index.html") {
            return new Response("SPA-SHELL", {
              status: 200,
              headers: { "content-type": "text/html" },
            });
          }
          if (p.endsWith(".html")) {
            return new Response("MARKETING:" + p, {
              status: 200,
              headers: { "content-type": "text/html" },
            });
          }
          // Raw passthrough for everything else (e.g. /_next/static/*).
          return new Response("ASSET:" + p, { status: 200 });
        },
      },
    };
  }

  beforeEach(() => {
    // Reset the module-level marketing-manifest cache so each case re-reads the
    // fresh mock env.
    __resetMarketingRoutesCache();
  });

  it("serves prerendered marketing HTML for /about", async () => {
    const res = await app.request("/about", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("MARKETING:/about.html");
  });

  it("normalizes a trailing slash so /about/ serves marketing HTML, not the SPA shell", async () => {
    const res = await app.request("/about/", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("MARKETING:/about.html");
  });

  it("serves marketing (NOT the SPA shell) for /pricing [D1]", async () => {
    const res = await app.request("/pricing", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("MARKETING:/pricing.html");
    expect(body).not.toBe("SPA-SHELL");
  });

  it("serves the SPA shell for /admin even though admin.html exists [D1 override]", async () => {
    const res = await app.request("/admin", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("SPA-SHELL");
    expect(body).not.toContain("MARKETING");
  });

  it("serves the authentic-economy console for /dashboard, not a 404 SPA miss", async () => {
    const res = await app.request("/dashboard", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("QRON Dashboard");
    expect(body).toContain("/onboard");
    expect(body).not.toBe("SPA-SHELL");
  });

  it("passes /_next/static/x.js through to ASSETS raw", async () => {
    const res = await app.request("/_next/static/x.js", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ASSET:/_next/static/x.js");
  });

  it("serves the SPA shell for an unknown path (spa-fallback)", async () => {
    const res = await app.request("/some-unknown-path", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("SPA-SHELL");
  });

  it("routes a dynamic-owned path through renderDynamicPage, not the bare shell (Task 3.3)", async () => {
    // Bare /verify has no ?id= and no path-segment identifier, so this
    // exercises dynamic-pages.ts real no-identifier branch (a rendered
    // verify prompt, no DB call needed) -- proving the "dynamic" owner now
    // goes through renderDynamicPage own logic and not just an
    // unconditional SPA-shell interim.
    const res = await app.request("/verify", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toBe("SPA-SHELL");
    expect(body).toContain("Verify a Product");
  });

  it("still serves the SPA shell for a stubbed dynamic route (Task 3.3 stub scope)", async () => {
    // /status is a still-stubbed dynamic route -- always the SPA shell.
    const res = await app.request("/status", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("SPA-SHELL");
  });

  it("passes a root-level static file (spa-fallback with extension) through raw", async () => {
    const res = await app.request("/favicon-qron.svg", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ASSET:/favicon-qron.svg");
  });

  it("serves a per-brand robots.txt pointing at the brand sitemap", async () => {
    const res = await app.request(
      "/robots.txt",
      { headers: { "x-forwarded-host": "qron.space" } },
      makeEnv() as any
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Sitemap: https://qron.space/sitemap.xml");
  });

  it("serves a per-brand sitemap.xml under the brand origin", async () => {
    const res = await app.request(
      "/sitemap.xml",
      { headers: { "x-forwarded-host": "qron.space" } },
      makeEnv() as any
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<loc>https://qron.space/</loc>");
    expect(body).toContain("<loc>https://qron.space/about</loc>");
    expect(body).toContain("urlset");
    expect(body).not.toContain("/_not-found");
  });

  it("injects per-brand title/description/og and window.__BRAND__ into the SPA shell", async () => {
    const shell =
      "<!doctype html><html><head>" +
      "<title>AuthiChain \u2013 Blockchain Product Authentication Platform</title>" +
      '<meta name="description" content="old default description" />' +
      '</head><body><div id="root"></div></body></html>';
    const htmlEnv = {
      ASSETS: {
        fetch: async (input: Request | string) => {
          const u = new URL(typeof input === "string" ? input : input.url);
          if (u.pathname === "/marketing-manifest.json")
            return new Response(JSON.stringify({ routes: MARKETING_ROUTES }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          if (u.pathname === "/index.html")
            return new Response(shell, {
              status: 200,
              headers: { "content-type": "text/html" },
            });
          return new Response("ASSET:" + u.pathname, { status: 200 });
        },
      },
    };
    const res = await app.request(
      "/",
      { headers: { "x-forwarded-host": "qron.space" } },
      htmlEnv as any
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>QRON");
    expect(html).toContain("AI-Generated QR Art That Scans.");
    expect(html).toContain('window.__BRAND__="qron"');
    expect(html).toContain("apple-touch-icon-qron.png");
    expect(html).not.toContain("Blockchain Product Authentication Platform");
  });

  it("serves the SPA shell (NOT the real admin.html) for /admin.html [regression: static-extension allowlist]", async () => {
    // /admin.html is spa-fallback (resolveOwner only special-cases the exact
    // "/admin" path, not "/admin.html"). Before the allowlist fix, the old
    // "last segment has a dot" heuristic treated ".html" as a static
    // extension and raw-fetched ASSETS, returning the real prerendered
    // admin.html (mocked here as "MARKETING:/admin.html") -- defeating the
    // D1 invariant that /admin must always be the SPA. ".html" must NOT be
    // in STATIC_ASSET_EXTENSIONS, so this must fall through to the shell.
    const res = await app.request("/admin.html", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("SPA-SHELL");
    expect(body).not.toBe("MARKETING:/admin.html");
    expect(body).not.toContain("MARKETING");
  });
});

describe("routing regression (Task 3.2 additive)", () => {
  it("GET /api/health still returns {status:ok}", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("POST /api/guardrail/check is mounted (not a 404 SPA fallthrough)", async () => {
    const res = await app.request("/api/guardrail/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "email.b2b-cold" }),
    });
    expect(res.status).not.toBe(404);
    expect(res.headers.get("content-type") ?? "").toMatch(/json/);
  });
});

describe("tRPC routes are handled by the tRPC middleware, not the * SPA fallback", () => {
  function makeTrpcEnv() {
    const indexHtmlFetch = vi.fn();
    return {
      env: {
        ASSETS: {
          fetch: async (input: Request | string) => {
            const url = new URL(typeof input === "string" ? input : input.url);
            if (url.pathname === "/index.html") {
              indexHtmlFetch(url.pathname);
              return new Response("SPA-SHELL", {
                status: 200,
                headers: { "content-type": "text/html" },
              });
            }
            if (url.pathname === "/marketing-manifest.json") {
              return new Response(JSON.stringify({ routes: [] }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }
            return new Response("ASSET:" + url.pathname, { status: 200 });
          },
        },
      },
      indexHtmlFetch,
    };
  }

  it("GET /api/trpc/system.health returns a tRPC-shaped JSON response, never the SPA shell", async () => {
    const { env, indexHtmlFetch } = makeTrpcEnv();
    const input = encodeURIComponent(
      JSON.stringify({ json: { timestamp: Date.now() } })
    );
    const res = await app.request(
      `/api/trpc/system.health?input=${input}`,
      {},
      env as any
    );

    // Never falls through to the "*" SPA-shell branch: /index.html is never
    // fetched from ASSETS for a /api/trpc/* request.
    expect(indexHtmlFetch).not.toHaveBeenCalled();

    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toMatch(/json/i);
    const body: any = await res.json();
    // superjson-transformer tRPC response shape: either a success envelope
    // ({ result: { data: ... } }) or a structured tRPC error envelope
    // ({ error: { ... } }) -- either proves the tRPC middleware (not the SPA
    // fallback) handled the request.
    expect(body).toSatisfy(
      (b: any) => b && typeof b === "object" && ("result" in b || "error" in b)
    );
    if (body.result) {
      expect(body.result.data.json).toEqual({ ok: true });
    }
  });
});
