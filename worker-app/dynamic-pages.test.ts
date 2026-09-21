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

vi.mock("./onboard-notify", () => ({
  notifyPilotIntake: vi.fn().mockResolvedValue(undefined),
}));

const { renderDynamicPage } = await import("./dynamic-pages");
const { notifyPilotIntake } = await import("./onboard-notify");
const { getHyperdriveDb } = await import("../server/db");
const { getCertificateByNumber, getProductById } =
  await import("../server/content-db-helpers");
const { getQronById } = await import("../server/identity-db-helpers");

// A tiny local Hono app wired straight to renderDynamicPage -- exercises the
// real Hono Context (c.redirect/c.html/c.env) instead of a hand-rolled fake,
// same spirit as routes.test.ts's `app.request(path, {}, env)`.
const app = new Hono();
app.all("*", c => renderDynamicPage(c));

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

    const res = await app.request(
      "/s/abc123",
      { redirect: "manual" },
      makeEnv() as any
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/dest");
    expect(getQronById).toHaveBeenCalledWith({}, "abc123");
  });

  it("redirects to home for an unknown shortcode (miss behavior)", async () => {
    (getQronById as any).mockResolvedValue(null);

    const res = await app.request(
      "/s/does-not-exist",
      { redirect: "manual" },
      makeEnv() as any
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  it("falls back to a home redirect if the db lookup throws", async () => {
    (getQronById as any).mockRejectedValue(new Error("db down"));

    const res = await app.request(
      "/s/whatever",
      { redirect: "manual" },
      makeEnv() as any
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  it("does not 500 on malformed percent-encoding and degrades to the home redirect", async () => {
    const res = await app.request(
      "/s/%zz",
      { redirect: "manual" },
      makeEnv() as any
    );

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

  it("bare /p is a clear 404, not a redirect and not a silent hub", async () => {
    const res = await app.request("/p", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(body).toContain("No serial number was provided.");
    expect(res.headers.get("location")).toBeNull();
    expect(getCertificateByNumber).not.toHaveBeenCalled();
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
    expect(getCertificateByNumber).toHaveBeenCalledWith(
      expect.anything(),
      "CERT-001"
    );
  });

  it("serves a committed SEO hub before the certificate lookup", async () => {
    const res = await app.request(
      "/p/what-is-a-digital-product-passport",
      {},
      makeEnv() as any
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("What a DPP contains");
    expect(body).toContain("<h2>Get started</h2>");
    expect(body).toContain('name="email"');
    expect(body).toContain('action="https://authichain.com/api/checkout/dpp"');
    expect(body).not.toContain(
      'href="https://authichain.com/api/checkout/dpp"'
    );
    expect(body).toContain(
      'href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"'
    );
    expect(body).toContain('type="application/ld+json"');
    expect(getCertificateByNumber).not.toHaveBeenCalled();
    expect(getHyperdriveDb).not.toHaveBeenCalled();
  });

  it("routes a cannabis SEO hub to live StrainChain passport checkout", async () => {
    const res = await app.request(
      "/p/cannabis-blockchain-provenance",
      {},
      makeEnv() as any
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("What you get");
    expect(body).toContain(
      'action="https://authichain.com/api/checkout/plan/strainchain_passport"'
    );
    expect(body).not.toContain(
      'href="https://authichain.com/api/checkout/plan/strainchain_passport"'
    );
    expect(body).toContain(
      'href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"'
    );
    expect(body).toContain('href="https://strainchain.io/pricing"');
    expect(getCertificateByNumber).not.toHaveBeenCalled();
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
      makeDbSelectStub([
        { id: 99, productId: 7, status: "active", certificateNumber: "C-99" },
      ])
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

describe("renderDynamicPage: /landing/<brandId> brand landing page", () => {
  it("returns 200 HTML with the brand's headline, features, and CTAs for a known brand", async () => {
    const res = await app.request("/landing/qron", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/html/i);
    expect(body).toContain("Transform QR Codes Into Stunning Artwork.");
    expect(body).toContain("11 AI Styles");
    expect(body).toContain('href="/qr-codes"');
    expect(body).toContain('rel="canonical"');
  });

  it("returns 404 HTML for an unconfigured brand id", async () => {
    const res = await app.request("/landing/not-a-brand", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(body).toContain("Brand Not Found");
  });

  it("returns 404 HTML for a bare /landing with no brand id", async () => {
    const res = await app.request("/landing", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(body).toContain("Brand Not Found");
  });

  it("strips a trailing slash so /landing/authichain/ resolves the same as /landing/authichain", async () => {
    const res = await app.request("/landing/authichain/", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Issue seals. Bind products. Verify anywhere.");
    expect(body).toContain('name="email"');
    expect(body).toContain('action="/api/checkout/dpp"');
    expect(body).toContain(
      'href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"'
    );
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

describe("renderDynamicPage: /onboard pilot intake", () => {
  it("returns 200 HTML with a real form", async () => {
    const res = await app.request("/onboard", {}, makeEnv() as any);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/html/i);
    expect(body).toContain("Onboard a Pilot");
    expect(body).toContain('<form action="/onboard" method="post">');
    expect(body).toContain('name="email"');
    expect(body).toContain('name="company"');
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await app.request(
      "/onboard",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "company=Acme",
      },
      makeEnv() as any
    );
    const body = await res.text();

    expect(res.status).toBe(400);
    expect(body).toContain("required");
  });

  it("303s a valid intake to /onboard/received", async () => {
    const res = await app.request(
      "/onboard",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "company=Trulieve&contactName=Jordan+Hale&email=jordan%40trulieve.com&vertical=strainchain&productName=Jar+Seal+01",
        redirect: "manual",
      },
      makeEnv() as any
    );

    expect(res.status).toBe(303);
    const location = res.headers.get("location") || "";
    expect(location).toContain("/onboard/received");
    expect(location).toContain("ref=");
    expect(location).toContain("vertical=strainchain");
  });

  it("waitUntils inbound notify before the 303 when executionCtx is present", async () => {
    const pending: Promise<unknown>[] = [];
    const res = await app.request(
      "/onboard",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "company=Trulieve&contactName=Jordan+Hale&email=jordan%40trulieve.com&vertical=strainchain&productName=Jar+Seal+01",
        redirect: "manual",
      },
      makeEnv({ RESEND_API_KEY2: "re_test" }) as any,
      {
        waitUntil: (p: Promise<unknown>) => {
          pending.push(p);
        },
      } as any
    );

    expect(res.status).toBe(303);
    expect(pending.length).toBe(1);
    await Promise.all(pending);
    expect(notifyPilotIntake).toHaveBeenCalledTimes(1);
    const arg = (notifyPilotIntake as any).mock.calls[0][0];
    expect(arg.company).toBe("Trulieve");
    expect(arg.contact).toBe("Jordan Hale");
    expect(arg.email).toBe("jordan@trulieve.com");
    expect(arg.vertical).toBe("strainchain");
    expect(arg.product).toBe("Jar Seal 01");
    expect(arg.ref).toMatch(/^[a-f0-9]{16}$/);
    expect(arg.env?.RESEND_API_KEY2).toBe("re_test");
  });

  it("void-notifies when executionCtx is missing and still 303s", async () => {
    const res = await app.request(
      "/onboard",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "company=Acme&contactName=Ada&email=ada%40acme.com&vertical=qron&productName=Living+QR",
        redirect: "manual",
      },
      makeEnv() as any
    );

    expect(res.status).toBe(303);
    expect(notifyPilotIntake).toHaveBeenCalled();
  });

  it("renders the received confirmation when a ref is present", async () => {
    const res = await app.request(
      "/onboard/received?ref=abcd1234&company=Trulieve&vertical=strainchain",
      {},
      makeEnv() as any
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Pilot request received");
    expect(body).toContain("abcd1234");
    expect(body).toContain("Trulieve");
    expect(body).toContain('name="email"');
    expect(body).toContain('action="/api/checkout/dpp"');
    expect(body).toContain(
      'href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"'
    );
  });
});

describe("renderDynamicPage: /dashboard console", () => {
  it("returns 200 HTML for /dashboard and /dapp", async () => {
    for (const path of ["/dashboard", "/dapp"]) {
      const res = await app.request(path, {}, makeEnv() as any);
      const body = await res.text();
      expect(res.status).toBe(200);
      expect(body).toContain("QRON Dashboard");
      expect(body).toContain("/onboard");
      expect(body).toContain("/generate");
    }
  });
});

describe("renderDynamicPage: /login and /authenticate", () => {
  it("returns 200 HTML with live apex CTAs", async () => {
    for (const path of ["/login", "/authenticate"]) {
      const res = await app.request(path, {}, makeEnv() as any);
      const body = await res.text();
      expect(res.status).toBe(200);
      expect(body).toContain("Sign in");
      expect(body).toContain("/onboard");
      expect(body).toContain("/dashboard");
      expect(body).toContain('name="email"');
      expect(body).toContain('action="/api/checkout/dpp"');
      expect(body).toContain(
        'href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"'
      );
      expect(body).not.toContain("app.authichain.com/login");
    }
  });
});

describe("renderDynamicPage: /generate Living QR", () => {
  it("returns 200 HTML with a real form", async () => {
    const res = await app.request("/generate", {}, makeEnv() as any);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("Generate a Living QR");
    expect(body).toContain(
      '<form id="generate-form" action="/generate" method="post">'
    );
    expect(body).toContain('name="targetUrl"');
    expect(body).toContain("fetch('/api/generate'");
    expect(body).toContain("if(r.res.status===401)");
    expect(body).toContain("form.submit()");
    expect(body).toContain("$29");
    expect(body).toContain("$99");
    expect(body).toContain("$299");
    expect(body).toContain(
      'href="https://buy.stripe.com/3cIaEX73jcZE5ia2321Nu1l"'
    );
    expect(body).toContain(
      'href="https://buy.stripe.com/9B69AT73j9NseSKazy1Nu1m"'
    );
    expect(body).toContain(
      'href="https://buy.stripe.com/9B600j73jcZE6megXW1Nu1n"'
    );
    expect(body).toContain("50 Credits");
    expect(body).toContain("$9.99");
    expect(body).toContain("250 Credits");
    expect(body).toContain("$39.99");
    expect(body).toContain("1000 Credits");
    expect(body).toContain("$99.99");
    expect(body).toContain("Need generation credits");
  });

  it("303s a valid URL to /onboard", async () => {
    const res = await app.request(
      "/generate",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "targetUrl=https%3A%2F%2Fexample.com%2Fsku&prompt=neon",
        redirect: "manual",
      },
      makeEnv() as any
    );
    expect(res.status).toBe(303);
    const location = res.headers.get("location") || "";
    expect(location).toContain("/onboard");
    expect(location).toContain("vertical=qron");
  });
});

describe("renderDynamicPage: /story StoryMode", () => {
  it("returns 200 HTML for the launch-proof object", async () => {
    const res = await app.request(
      "/story/00000000-0000-4000-8000-000000000001",
      {},
      makeEnv() as any
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("AuthiChain Launch Proof");
    expect(body).toContain("lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE");
    expect(body).toContain("StoryMode");
  });

  it("returns 404 HTML for an unknown story id", async () => {
    (getCertificateByNumber as any).mockResolvedValue(undefined);
    (getProductById as any).mockResolvedValue(undefined);
    (getHyperdriveDb as any).mockReturnValue(makeDbSelectStub([]));

    const res = await app.request(
      "/story/does-not-exist",
      {},
      makeEnv() as any
    );
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(body).toContain("Story not found");
  });
});
