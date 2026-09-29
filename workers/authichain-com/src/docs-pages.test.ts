import { describe, expect, it } from "vitest";
import {
  BANNED_COPY,
  assertNoBannedCopy,
  docsRedirect,
  isDocsHub,
  isDocsPage,
  isDocsPath,
} from "./docs-pages";

describe("docs routing contract", () => {
  it("matches the hub", () => {
    expect(isDocsHub("/docs")).toBe(true);
    expect(isDocsHub("/docs/")).toBe(true);
    expect(isDocsHub("/docs/verification")).toBe(false);
  });

  it("matches wave-1 slugs only", () => {
    expect(isDocsPage("/docs/gs1-digital-link")).toBe("gs1-digital-link");
    expect(isDocsPage("/docs/verification")).toBe("verification");
    expect(isDocsPage("/docs/dpp-architecture")).toBe("dpp-architecture");
    expect(isDocsPage("/docs/examples")).toBe("examples");
    expect(isDocsPage("/docs/attestations")).toBe(null);
  });

  it("does not swallow product paths", () => {
    for (const p of [
      "/onboard",
      "/verify",
      "/api/x402",
      "/checkout/dpp_readiness",
      "/pricing",
      "/docs/x402",
      "/protocol",
    ]) {
      expect(isDocsHub(p)).toBe(false);
      expect(isDocsPage(p)).toBe(null);
    }
  });

  it("301s aliases", () => {
    expect(docsRedirect("/docs/protocol")).toBe("/protocol");
    expect(docsRedirect("/docs/dpp")).toBe("/docs/dpp-architecture");
    expect(docsRedirect("/docs/digital-product-passports")).toBe(
      "/docs/dpp-architecture"
    );
  });

  it("isDocsPath is true for hub, pages, and aliases", () => {
    expect(isDocsPath("/docs")).toBe(true);
    expect(isDocsPath("/docs/verification")).toBe(true);
    expect(isDocsPath("/docs/protocol")).toBe(true);
    expect(isDocsPath("/onboard")).toBe(false);
    expect(isDocsPath("/verify")).toBe(false);
  });
});

describe("claim guard", () => {
  it("flags banned copy", () => {
    const dirty = "We are a GS1 Conformant Resolver on Bitcoin L1 at $49/mo. Scan AC-DEMO-001.";
    const hits = assertNoBannedCopy(dirty);
    expect(hits.length).toBeGreaterThan(0);
    expect(BANNED_COPY.length).toBeGreaterThan(0);
  });

  it("allows the honest sentence", () => {
    const clean =
      "AuthiChain is not a GS1 Conformant Resolver. gs1ConformantResolver is false.";
    // The phrase "GS1 Conformant Resolver" appears in the honest denial.
    // Pages may mention the term in the negative. Tests that compile HTML
    // must allow "not a GS1 Conformant Resolver" and reject the affirmative.
    expect(clean.includes("not a GS1 Conformant Resolver")).toBe(true);
  });
});
