import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The GPT plugin routes and the gateway's /api/internal routes (which back
 * the public MCP verify_product tool) used to invent verdicts: an LLM guess
 * for unknown identifiers, "may be counterfeit" for a missing product,
 * "VERIFIED AUTHENTIC / blockchain SECURED" for any certificate row whatever
 * its status, "METRC compliant" from a name match, and verified:true for any
 * strain. These tests pin the canonical vocabulary instead.
 */

const { queue, certByNumber, llm } = vi.hoisted(() => {
  process.env.INTERNAL_API_SECRET = "internal-test-secret";
  return {
    queue: [] as unknown[][],
    certByNumber: { value: undefined as unknown },
    llm: vi.fn(),
  };
});

vi.mock("../server/db", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = async () => queue.shift() ?? [];
  return { getHyperdriveDb: vi.fn().mockReturnValue(chain) };
});
vi.mock("../server/content-db-helpers", () => ({
  getCertificateByNumber: vi.fn(async () => certByNumber.value),
}));
vi.mock("../server/_core/llm", () => ({ invokeLLM: llm, parseLLMContent: vi.fn() }));
vi.mock("../server/webhooks/stripe", () => ({ handleStripeWebhook: vi.fn() }));
vi.mock("../server/paddle/webhook", () => ({ handlePaddleWebhook: vi.fn() }));
vi.mock("../server/webhooks/instantly", () => ({ handleInstantlyWebhook: vi.fn() }));
vi.mock("../server/webhooks/docusign", () => ({ handleDocuSignWebhook: vi.fn() }));
vi.mock("../server/_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("../server/_core/db-helpers", () => ({
  getOpsSummary: vi.fn().mockResolvedValue({ ok: true }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

const { app } = await import("./index");

const post = (path: string, body: unknown, internal = false) =>
  app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(internal ? { "x-internal-secret": "internal-test-secret" } : {}),
    },
    body: JSON.stringify(body),
  });

const FORBIDDEN = /may be counterfeit|VERIFIED AUTHENTIC|SECURED|METRC compliant|"compliant"/;

beforeEach(() => {
  queue.length = 0;
  certByNumber.value = undefined;
  llm.mockReset();
});

describe("GPT plugin verify routes", () => {
  it("a missing product is not_found, never counterfeit", async () => {
    queue.push([]);
    const res = await post("/api/gpt/verify", { productId: 7 });
    const body = await res.json();
    expect(body).toMatchObject({ verified: false, valid: false, decision: "not_found", trustScore: null });
    expect(JSON.stringify(body)).not.toMatch(FORBIDDEN);
  });

  it("a product with a revoked certificate is revoked, not verified", async () => {
    queue.push([{ id: 7, name: "Widget", brand: "Acme" }]);
    queue.push([{ id: "c1", status: "revoked", blockchainTxHash: "0xabc" }]);
    const body = await (await post("/api/gpt/verify", { productId: 7 })).json();
    expect(body).toMatchObject({ verified: false, decision: "revoked", certificateId: "c1" });
    expect(JSON.stringify(body)).not.toMatch(FORBIDDEN);
  });

  it("an active certificate row alone is indeterminate and points at the canonical verifier", async () => {
    queue.push([{ id: 7, name: "Widget" }]);
    queue.push([{ id: "c1", status: "active" }]);
    const body = await (await post("/api/gpt/verify", { productId: 7 })).json();
    expect(body).toMatchObject({
      verified: false,
      decision: "indeterminate",
      registry: { found: true, status: "active", anchored: false },
    });
    expect(body.next_step).toContain("/api/v1/attestation/verify");
  });

  it("certificate lookup does not call a revoked certificate valid", async () => {
    queue.push([{ id: "c9", status: "revoked", issuedAt: "2026-01-01T00:00:00Z" }]);
    const res = await app.request("/api/gpt/certificates/verify?certNumber=AC-9");
    expect(await res.json()).toMatchObject({ valid: false, decision: "revoked", certificateId: "c9" });
  });

  it("a strain name match does not claim METRC compliance", async () => {
    queue.push([{ id: 1, name: "Blue Dream" }]);
    const body = await (await post("/api/gpt/cannabis/verify", { strainName: "Blue Dream" })).json();
    expect(body).toMatchObject({ verified: false, decision: "indeterminate", metrc_compliance: "not_assessed" });
    expect(body).not.toHaveProperty("metrcCompliant");
    expect(JSON.stringify(body)).not.toMatch(FORBIDDEN);
  });

  it("trust score no longer labels an uncertified product SUSPICIOUS", async () => {
    queue.push([{ id: 7, name: "Widget" }]);
    queue.push([]);
    const body = await (await post("/api/gpt/trust-score", { productId: 7 })).json();
    expect(body).toMatchObject({ trustScore: null, decision: "indeterminate", valid: false });
    expect(JSON.stringify(body)).not.toMatch(/SUSPICIOUS|TRUSTED/);
  });
});

describe("internal gateway verify routes (MCP verify_product backend)", () => {
  it("an unknown identifier is not_found and no LLM is consulted", async () => {
    const res = await post("/api/internal/verify", { identifier: "SKU-UNKNOWN" }, true);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ verified: false, decision: "not_found", type: "not_found", trustScore: null });
    expect(llm).not.toHaveBeenCalled();
    expect(body).not.toHaveProperty("agents");
  });

  it("a known certificate is a registry record, not a 95-point verification", async () => {
    certByNumber.value = { id: "c1", status: "active", certificateNumber: "AC-1" };
    const body = await (await post("/api/internal/verify", { identifier: "AC-1" }, true)).json();
    expect(body).toMatchObject({ verified: false, decision: "indeterminate", type: "certificate", trustScore: null });
    expect(llm).not.toHaveBeenCalled();
  });

  it("cannabis verify never says verified or compliant and never invents a panel", async () => {
    const body = await (
      await post("/api/internal/cannabis/verify", { strainName: "Blue Dream", dispensaryId: "D-1" }, true)
    ).json();
    expect(body).toMatchObject({
      verified: false,
      decision: "indeterminate",
      complianceStatus: "not_assessed",
      rarityScore: null,
      rarity_basis: "not_computed",
    });
  });

  it("trust score is advisory and does not default the QR check to passed", async () => {
    const body = await (await post("/api/internal/trust-score", {}, true)).json();
    expect(body).toMatchObject({ advisory: true, verified: false, decision: "indeterminate", score: 0 });
    expect(body).not.toHaveProperty("verdict");
  });
});
