import { describe, expect, it } from "vitest";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import { isLlmsTxtPath, renderLlmsTxt, tryHandleLlmsTxt } from "./llms-txt";

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
    expect(text).toContain("https://authichain.com/api/x402/catalog");
    expect(text).toContain("https://authichain.com/.well-known/x402.json");
    expect(text).toContain("https://authichain.com/.well-known/x402");
    expect(text).toContain("https://authichain.com/openapi.json");
    expect(text).toContain("https://authichain.com/mcp");
    expect(text).toContain("https://authichain.com/battery-passport");
    expect(text).toContain("18 February 2027");
    expect(text).toContain("e-bike / LMT");
    expect(text).toContain(planPaymentLink("qron_launch"));
    expect(text).toContain(planPaymentLink("starter"));
    expect(text).toContain(planPaymentLink("creator"));
    expect(text).toContain("https://authichain.com/generate");
    expect(text).toContain(planPaymentLink("dpp_readiness"));
    expect(text).toContain(planPaymentLink("strainchain_passport"));
    expect(text).not.toContain(planPaymentLink("strainchain_farm"));
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
});
