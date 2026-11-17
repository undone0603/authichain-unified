import { describe, expect, it } from "vitest";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import {
  isLlmsTxtPath,
  prefersMarkdown,
  renderHomepageMarkdown,
  renderLlmsTxt,
  renderNotFoundMarkdown,
  tryHandleHomepageMarkdown,
  tryHandleLlmsTxt,
} from "./llms-txt";

describe("llms.txt", () => {
  it("recognizes agent discovery paths", () => {
    expect(isLlmsTxtPath("/llms.txt")).toBe(true);
    expect(isLlmsTxtPath("/.well-known/llms.txt")).toBe(true);
    expect(isLlmsTxtPath("/llms.txt/")).toBe(true);
    expect(isLlmsTxtPath("/robots.txt")).toBe(false);
    expect(isLlmsTxtPath("/")).toBe(false);
  });

  it("points agents at Payment Links and unpaid POST x402, not GET checkout", () => {
    const text = renderLlmsTxt();
    expect(text).toContain("# AuthiChain");
    expect(text).toContain("POST https://authichain.com/api/x402");
    expect(text).toContain(
      "An empty JSON body is the unpaid HTTP 402. A non-UUID sealId is HTTP 400 before payment."
    );
    expect(text).toContain("https://authichain.com/api/x402/catalog");
    expect(text).toContain("https://authichain.com/.well-known/x402.json");
    expect(text).toContain("https://authichain.com/.well-known/x402");
    expect(text).toContain("https://authichain.com/openapi.json");
    expect(text).toContain("https://authichain.com/mcp");
    expect(text).toContain("https://authichain.com/battery-passport");
    expect(text).toContain("https://authichain.com/coffee");
    expect(text).toContain("POST https://authichain.com/api/coffee/checkout");
    expect(text).toContain(
      "Fictional Ed25519-signed LMT demonstration record (signed by bundled demo key https://authichain.com/battery-passport/sample.jwks.json, not live /.well-known/jwks.json; not an Article 77 passport): https://authichain.com/battery-passport/sample"
    );
    expect(text).toContain("18 February 2027");
    expect(text).toContain("e-bike / LMT");
    // Retired for new buyers: /checkout/qron_launch answers 303 to /pricing.
    expect(text).not.toContain("/checkout/qron_launch");
    expect(text).not.toContain("QRON Launch");
    expect(text).toContain(planPaymentLink("starter"));
    expect(text).toContain(planPaymentLink("creator"));
    expect(text).toContain("https://authichain.com/generate");
    expect(text).toContain("EU DPP Workspace $299");
    expect(text).toContain(planPaymentLink("dpp_readiness"));
    expect(text).not.toContain("EU DPP Readiness $");
    expect(text).toContain(planPaymentLink("strainchain_passport"));
    expect(text).toContain(planPaymentLink("musa_claim_file"));
    expect(text).toContain(planPaymentLink("musa_audit_bundle"));
    expect(text).toContain(planPaymentLink("battery_gap_report"));
    expect(text).toContain(planPaymentLink("gov_provenance_pilot"));
    expect(text).toContain(planPaymentLink("strainchain_farm"));
    expect(text).not.toContain("GET /api/checkout");
    expect(text.toLowerCase()).not.toContain("facilitator.payai");
  });

  it("answers GET and ignores other paths", async () => {
    const hit = tryHandleLlmsTxt(
      new Request("https://authichain.govchain.us/llms.txt")
    );
    expect(hit).not.toBeNull();
    expect(hit?.status).toBe(200);
    expect(hit?.headers.get("content-type")).toMatch(/text\/plain/);
    expect(await hit!.text()).toContain("POST https://authichain.com/api/x402");
    expect(
      tryHandleLlmsTxt(new Request("https://authichain.govchain.us/pricing"))
    ).toBeNull();
  });
  it("names the canonical paid verify endpoint and the health check", () => {
    const text = renderLlmsTxt();
    expect(text).toContain(
      "Canonical paid verify: POST https://authichain.com/api/v1/agent-verify"
    );
    expect(text).toContain("https://authichain.com/api/x402/health");
    expect(text).toContain(
      "paidVerify.bound false means HTTP 503 before settlement"
    );
  });

  it("names the canonical Living QR scan and says this host verifies", () => {
    const text = renderLlmsTxt();
    expect(text).toContain(
      "Living QR scan: GET https://authichain.com/qron/r/{object_id}"
    );
    expect(text).toContain(
      "Decision v1 verify: POST https://authichain.com/api/v1/attestation/verify"
    );
    expect(text).toContain("https://authichain.com/protocol/issuer.json");
    expect(text).toContain("https://authichain.com/protocol/jwks.json");
    expect(text).toContain("This host verifies the signature");
    expect(text).not.toContain("does not verify the signature");
    expect(text).not.toContain("freeCalls");
    expect(text).toContain(
      "Published demonstration record, not a customer product: GET https://authichain.com/api/verify?id=polygon-anchor-1"
    );
    expect(text).toContain(
      "https://authichain.com/protocol/examples/polygon-anchor-1.record.json"
    );
    expect(text).toContain(
      "https://authichain.com/protocol/examples/polygon-anchor-1.anchor.json"
    );
    expect(text).not.toContain("polygonscan.com");
  });

  it("names when to use AuthiChain", () => {
    const text = renderLlmsTxt();
    expect(text).toContain("## When to use this");
    expect(text).toContain(
      "paid, machine-readable check of a signed product seal"
    );
    expect(text).toContain("POST https://authichain.com/api/v1/agent-verify");
  });

  it("prefers markdown only when Accept names text/markdown", () => {
    expect(
      prefersMarkdown(
        new Request("https://authichain.com/", {
          headers: { Accept: "text/markdown" },
        })
      )
    ).toBe(true);
    expect(
      prefersMarkdown(
        new Request("https://authichain.com/", {
          headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
        })
      )
    ).toBe(false);
    expect(prefersMarkdown(new Request("https://authichain.com/"))).toBe(false);
    expect(
      prefersMarkdown(
        new Request("https://authichain.com/", {
          headers: { Accept: "text/html;q=0.9, text/markdown;q=1" },
        })
      )
    ).toBe(true);
  });

  it("homepage markdown states what, cost, pay, receive, and verify", () => {
    const text = renderHomepageMarkdown();
    expect(text).toContain("WHAT IS SOLD");
    expect(text).toContain("WHAT IT COSTS");
    expect(text).toContain("HOW TO PAY");
    expect(text).toContain("WHAT YOU RECEIVE");
    expect(text).toContain("HOW DELIVERY IS VERIFIED");
    expect(text).toContain("X-PAYMENT");
    expect(text).toContain("/checkout/starter");
    expect(text.length).toBeGreaterThan(20);
  });

  it("404 markdown points agents at llms.txt", () => {
    const text = renderNotFoundMarkdown("/__missing-agent-path");
    expect(text).toContain("404");
    expect(text).toContain("/__missing-agent-path");
    expect(text).toContain("https://authichain.com/llms.txt");
    expect(text.length).toBeGreaterThan(20);
  });

  it("serves homepage markdown for Accept text/markdown", async () => {
    const hit = tryHandleHomepageMarkdown(
      new Request("https://authichain.com/", {
        headers: { Accept: "text/markdown" },
      })
    );
    expect(hit).not.toBeNull();
    expect(hit?.status).toBe(200);
    expect(hit?.headers.get("content-type")).toMatch(/text\/markdown/);
    expect(hit?.headers.get("vary")).toMatch(/Accept/i);
    expect(await hit!.text()).toContain("WHAT IS SOLD");
    expect(
      tryHandleHomepageMarkdown(
        new Request("https://authichain.com/", {
          headers: { Accept: "text/html" },
        })
      )
    ).toBeNull();
  });
});
