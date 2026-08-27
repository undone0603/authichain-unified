import { describe, it, expect } from "vitest";
import {
  SPA_OWNED_PREFIXES,
  DYNAMIC_HANDLER_PATHS,
  resolveOwner,
} from "./route-manifest";

// A representative handful of the D1-resolved marketing-static routes
// (Next.js SSG, src/app/**) plus a few unrelated marketing pages.
const marketingRoutes = new Set([
  "/about",
  "/pricing",
  "/vs/vechain",
  "/demo",
  "/qr-codes",
  "/supply-chain",
  "/white-label",
  "/contact",
  "/eu-dpp",
]);

describe("resolveOwner", () => {
  it("routes /api/* to api", () => {
    expect(resolveOwner("/api/trpc/x", marketingRoutes)).toBe("api");
  });

  it("routes bare /api to api", () => {
    expect(resolveOwner("/api", marketingRoutes)).toBe("api");
  });

  it("routes /_next/* to marketing (static passthrough)", () => {
    expect(resolveOwner("/_next/static/chunk.js", marketingRoutes)).toBe("marketing");
  });

  it("routes exact dynamic-handler paths to dynamic", () => {
    expect(resolveOwner("/verify", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/status", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/grants", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/gallery", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/s", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/p", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/brand/qron/artwork", marketingRoutes)).toBe("dynamic");
  });

  it("routes nested paths under a dynamic-handler path to dynamic (prefix match)", () => {
    expect(resolveOwner("/reveal/xyz", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/s/abc123", marketingRoutes)).toBe("dynamic");
    expect(resolveOwner("/p/serial-1", marketingRoutes)).toBe("dynamic");
  });

  it("routes SPA-owned prefixes to spa", () => {
    expect(resolveOwner("/dashboard", marketingRoutes)).toBe("spa");
    expect(resolveOwner("/admin/products", marketingRoutes)).toBe("spa");
    expect(resolveOwner("/qr-gallery", marketingRoutes)).toBe("spa");
  });

  it("does not let /administrator falsely match the /admin prefix", () => {
    // boundary-aware matching: "/administrator" must NOT match "/admin"
    expect(resolveOwner("/administrator", marketingRoutes)).toBe("spa-fallback");
  });

  it("prefers marketing-static over SPA for the D1-resolved collisions", () => {
    expect(resolveOwner("/pricing", marketingRoutes)).toBe("marketing");
    expect(resolveOwner("/demo", marketingRoutes)).toBe("marketing");
    expect(resolveOwner("/qr-codes", marketingRoutes)).toBe("marketing");
    expect(resolveOwner("/supply-chain", marketingRoutes)).toBe("marketing");
    expect(resolveOwner("/white-label", marketingRoutes)).toBe("marketing");
  });

  it("routes exact marketing routes to marketing", () => {
    expect(resolveOwner("/about", marketingRoutes)).toBe("marketing");
    expect(resolveOwner("/vs/vechain", marketingRoutes)).toBe("marketing");
  });

  it("routes unknown paths to spa-fallback", () => {
    expect(resolveOwner("/some-unknown", marketingRoutes)).toBe("spa-fallback");
  });

  it("routes root / to spa-fallback (D2: SPA renders brand home by Host)", () => {
    expect(resolveOwner("/", marketingRoutes)).toBe("spa-fallback");
  });

  it("does not include / in SPA_OWNED_PREFIXES", () => {
    expect(SPA_OWNED_PREFIXES).not.toContain("/");
  });

  it("excludes the D1 marketing-static collisions from SPA_OWNED_PREFIXES", () => {
    for (const collision of ["/demo", "/pricing", "/qr-codes", "/supply-chain", "/white-label"]) {
      expect(SPA_OWNED_PREFIXES).not.toContain(collision);
    }
  });

  it("excludes DYNAMIC_HANDLER_PATHS entries from SPA_OWNED_PREFIXES", () => {
    for (const dynamicPath of DYNAMIC_HANDLER_PATHS) {
      expect(SPA_OWNED_PREFIXES).not.toContain(dynamicPath);
    }
  });

  it("keeps the SPA's own /qr-gallery route distinct from the dynamic /gallery route", () => {
    expect(SPA_OWNED_PREFIXES).toContain("/qr-gallery");
    expect(DYNAMIC_HANDLER_PATHS.has("/qr-gallery")).toBe(false);
    expect(resolveOwner("/qr-gallery", marketingRoutes)).toBe("spa");
    expect(resolveOwner("/gallery", marketingRoutes)).toBe("dynamic");
  });
});
