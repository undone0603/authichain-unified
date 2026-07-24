import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Node-safe mocking (mirrors worker-app/routes.test.ts's pattern): mock
// getHyperdriveDb + the specific db helpers dynamic-pages.ts calls, so this
// suite never touches a real Postgres/Hyperdrive connection or workerd.
vi.mock("../server/db", () => ({
  getHyperdriveDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../server/content-db-helpers", () => ({
  getCertificateByNumber: vi.fn(),
  getProductById: vi.fn(),
}));

vi.mock("../server/identity-db-helpers", () => ({
  getQronById: vi.fn(),
}));

const { renderDynamicPage } = await import("./dynamic-pages");
const { getHyperdriveDb } = await import("../server/db");
const { getCertificateByNumber, getProductById } = await import("../server/content-db-helpers");
const { getQronById } = await import("../server/identity-db-helpers");

// A tiny local Hono app wired straight to renderDynamicPage -- exercises the
// real Hono Context (c.redirect/c.html/c.env) instead of a hand-rolled fake,
// same spirit as routes.test.ts's `app.request(path, {}, env)`.
const app = new Hono();
app.get("*", (c) => renderDynamicPage(c));

function makeEnv(dbOverrides?: Record<string, any>) {
  return {
    ASSETS: {
      fetch: async (input: Request | string) => {
        const url = new URL(typeof input === "string" ? input : input.url);
        if (url.pathname === "/index.html") {
          return new Response("SPA-SHELL", {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        }
        return new Response("ASSET:" + url.pathname, { status: 200 });
      },
    },
    ...dbOverrides,
  };
}

// A minimal drizzle-query-builder-shaped stub so `db.select().from().where().limit()`
// resolves to `rows` without needing a real Drizzle/Postgres instance.
function makeDbSelectStub(rows: any[]) {
  const builder: any = {
    from: () => builder,
    where: () => builder,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => builder };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getHyperdriveDb as any).mockReturnValue({});
});

describe("renderDynamicPage: /s/<shortcode> shortlink redirect", () => {
  it("302s to the stored target URL for a known shortcode", async () => {
    (getQronById as any).mockResolvedValue({
      id: "abc123",
      targetUrl: "https://example.com/dest",
      storyEnabled: false,
    });

    const res = await app.request("/s/abc123", { redirect: "manual" }, makeEnv() as any);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/dest");
    expect(getQronById).toHaveBeenCalledWith({}, "abc123");
  });

  it("redirects to home for an unknown shortcode (miss behavior)", async () => {
    (getQronById as any).mockResolvedValue(null);

    const res = await app.request("/s/does-not-exist", { redirect: "manual" }, makeEnv() as any);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  it("falls back to a home redirect if the db lookup throws", async () => {
    (getQronById as any).mockRejectedValue(new Error("db down"));

    const res = await app.request("/s/whatever", { redirect: "manual" }, makeEnv() as any);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  it("does not 500 on malformed percent-encoding and degrades to the home redirect", async () => {
    const res = await app.request("/s/%zz", { redirect: "manual" }, makeEnv() as any);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect(getQronById).not.toHaveBeenCalled();
  });
});

describe("renderDynamicPage: /p/<serial> product passport", () => {
  it("returns 200 HTML containing the product name for a known certificate number", async () => {
    (getCertificateByNumber as any).mockResolvedValue({
      id: 1,
      productId: 42,
      certificateNumber: "CERT-001",
      status: "active",
    });
    (getProductById as any).mockResolvedValue({
      id: 42,
      name: "Golden Widget",
      brand: "Acme",
      description: "A very fine widget.",
      manufacturer: "Acme Corp",
      serialNumber: "CERT-001",
    });
    (getHyperdriveDb as any).mockReturnValue(makeDbSelectStub([]));

    const res = await app.request("/p/CERT-001", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/html/i);
    expect(body).toContain("Golden Widget");
    expect(body).toContain("<title>");
    expect(body).toContain('rel="canonical"');
  });

  it("returns 404 HTML when neither certificate nor product-serial lookup matches", async () => {
    (getCertificateByNumber as any).mockResolvedValue(undefined);
    (getHyperdriveDb as any).mockReturnValue(makeDbSelectStub([]));

    const res = await app.request("/p/nope", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(body).toContain("Product Not Found");
  });

  it("does not 500 on malformed percent-encoding (falls back to the SPA shell)", async () => {
    const res = await app.request("/p/%zz", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toBe("SPA-SHELL");
    expect(getCertificateByNumber).not.toHaveBeenCalled();
  });

  it("strips a trailing slash so /p/CERT-001/ resolves the same as /p/CERT-001", async () => {
    (getCertificateByNumber as any).mockResolvedValue({
      id: 1,
      productId: 42,
      certificateNumber: "CERT-001",
      status: "active",
    });
    (getProductById as any).mockResolvedValue({
      id: 42,
      name: "Golden Widget",
      brand: "Acme",
      description: "A very fine widget.",
      manufacturer: "Acme Corp",
      serialNumber: "CERT-001",
    });
    (getHyperdriveDb as any).mockReturnValue(makeDbSelectStub([]));

    const res = await app.request("/p/CERT-001/", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Golden Widget");
    expect(getCertificateByNumber).toHaveBeenCalledWith(expect.anything(), "CERT-001");
  });
});

describe("renderDynamicPage: /verify verification landing", () => {
  it("returns the minimal prompt (200 HTML, no db call) when no identifier is present", async () => {
    const res = await app.request("/verify", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Verify a Product");
    expect(getProductById).not.toHaveBeenCalled();
  });

  it("returns 200 HTML with the verification status for a known product id", async () => {
    (getProductById as any).mockResolvedValue({
      id: 7,
      name: "Verified Sneaker",
      brand: "Nike-ish",
      category: "footwear",
    });
    (getHyperdriveDb as any).mockReturnValue(
      makeDbSelectStub([{ id: 99, productId: 7, status: "active", certificateNumber: "C-99" }]),
    );

    const res = await app.request("/verify?id=7", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Verified Sneaker");
    expect(body).toContain("Authentic Product Verified");
  });

  it("does not 500 on malformed percent-encoding (falls back to the SPA shell)", async () => {
    const res = await app.request("/verify/%zz", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toBe("SPA-SHELL");
    expect(getProductById).not.toHaveBeenCalled();
  });
});

describe("renderDynamicPage: stub routes serve the SPA shell", () => {
  it("serves the SPA shell for /status", async () => {
    const res = await app.request("/status", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toBe("SPA-SHELL");
  });

  it("serves the SPA shell for /reveal/<id>", async () => {
    const res = await app.request("/reveal/abc", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toBe("SPA-SHELL");
  });
});
