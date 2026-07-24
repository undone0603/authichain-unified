import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/webhooks/stripe", () => ({
  handleStripeWebhook: vi.fn().mockResolvedValue({ received: true }),
}));

vi.mock("../server/paddle/webhook", () => ({
  handlePaddleWebhook: vi.fn().mockImplementation(async (_db: unknown, _req: unknown, res: any) => {
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
    expect(Buffer.from(args[1]).toString()).toBe("raw-stripe-payload");
    expect(args[2]).toBe("t=123,v1=fake");
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
    const res = await app.request("/api/paddle/webhook", { method: "POST", body: "x" });
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
    const { handleInstantlyWebhook } = await import("../server/webhooks/instantly");
    const args = (handleInstantlyWebhook as any).mock.calls.at(-1);
    expect(args[1]).toEqual({ event: "email_opened", email: "a@b.com" });
  });
});

describe("POST /api/webhooks/docusign", () => {
  it("forwards the parsed JSON payload to the handler", async () => {
    const res = await app.request("/api/webhooks/docusign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "envelope-sent", recipientEmail: "a@b.com" }),
    });
    expect(res.status).toBe(200);
    const { handleDocuSignWebhook } = await import("../server/webhooks/docusign");
    const args = (handleDocuSignWebhook as any).mock.calls.at(-1);
    expect(args[1]).toEqual({ event: "envelope-sent", recipientEmail: "a@b.com" });
  });
});

describe("GET /api/admin/ops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    const { sdk } = await import("../server/_core/sdk");
    (sdk.authenticateRequest as any).mockRejectedValueOnce(new Error("no session"));
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
      body: JSON.stringify({ name: "Zac", email: "not-an-email", message: "hi" }),
    });
    expect(res.status).toBe(400);
  });

  it("succeeds without attempting SMTP when unconfigured", async () => {
    const res = await app.request("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Zac", email: "zac@example.com", message: "hi" }),
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

  it("serves the SPA shell for /dashboard", async () => {
    const res = await app.request("/dashboard", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("SPA-SHELL");
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

  it("passes /robots.txt through raw (allowlisted static extension)", async () => {
    const res = await app.request("/robots.txt", {}, makeEnv() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ASSET:/robots.txt");
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
    const input = encodeURIComponent(JSON.stringify({ json: { timestamp: Date.now() } }));
    const res = await app.request(`/api/trpc/system.health?input=${input}`, {}, env as any);

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
      (b: any) => (b && typeof b === "object" && ("result" in b || "error" in b)),
    );
    if (body.result) {
      expect(body.result.data.json).toEqual({ ok: true });
    }
  });
});
