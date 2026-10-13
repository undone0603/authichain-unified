// @vitest-environment node
import { describe, expect, it, afterEach } from "vitest";
import { Hono } from "hono";
import { exportPKCS8, generateKeyPair } from "jose";
import { registerAttestationApi, type AttestationRegistry } from "./attestation-api";
import { registerJwksRoute } from "./jwks";

const SAMPLE = {
  version: "0.1",
  attestation_id: "urn:authichain:attestation:v01:decision-route",
  issuer: { id: "https://authichain.govchain.us", name: "AuthiChain" },
  subject: { object_id: "authi:test:decision-route" },
  decision: "verified",
  status: "active",
  issued_at: "2026-09-19T00:00:00Z",
  evidence: [{ id: "unit", type: "test", digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
};

function registryFor(status?: "active" | "revoked" | "expired" | "superseded", issuerStatus: "trusted" | "suspended" = "trusted"): AttestationRegistry {
  return {
    getCurrentStatus: async () => ({
      ok: true as const,
      status: status ? {
        attestationId: SAMPLE.attestation_id,
        claimStatus: status,
        effectiveAt: "2026-10-10T00:00:00Z",
        issuerId: SAMPLE.issuer.id,
        eventId: "urn:authichain:event:test",
      } : null,
    }),
    getIssuer: async () => ({
      ok: true as const,
      issuer: {
        issuerId: SAMPLE.issuer.id,
        organization: "AuthiChain",
        issuerType: "service" as const,
        jwksUri: "https://authichain.com/protocol/jwks.json",
        status: issuerStatus,
        validFrom: "2026-01-01T00:00:00Z",
      },
    }),
    recordStatusEvent: async () => ({ ok: true as const, eventId: "urn:authichain:event:test" }),
  };
}

describe("canonical /api/v1/attestation/verify decision propagation", () => {
  afterEach(() => {
    delete process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
    delete process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
  });

  async function setup(registry = registryFor()) {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "decision-route-kid";
    process.env.CRON_SECRET = "issuer-test-secret";
    const app = new Hono();
    registerJwksRoute(app);
    registerAttestationApi(app, registry);
    const sign = async (overrides: Record<string, unknown> = {}) => {
      const res = await app.request("/api/v1/attestation", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer issuer-test-secret" },
        body: JSON.stringify({ ...SAMPLE, ...overrides }),
      });
      expect(res.status).toBe(200);
      return (await res.json() as { jws: string }).jws;
    };
    return { app, sign };
  }

  it("returns the resolved verified decision, not a parallel evaluation vocabulary", async () => {
    const { app, sign } = await setup();
    const res = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws: await sign() }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      valid: true,
      decision: "verified",
      decision_contract: "AuthiChain Verification Decision v1",
      claim_status: "active",
      reasons: [],
    });
  });

  it("keeps signed warning and blocked decisions non-positive", async () => {
    for (const decision of ["warning", "blocked"] as const) {
      const { app, sign } = await setup();
      const res = await app.request("/api/v1/attestation/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: await sign({ decision }) }),
      });
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        valid: false,
        decision,
        decision_contract: "AuthiChain Verification Decision v1",
        reasons: [`decision_${decision}`],
      });
    }
  });

  it("maps durable expiry to expired without bypassing signing validation", async () => {
    const { app, sign } = await setup(registryFor("expired"));
    const res = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws: await sign() }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "expired",
      claim_status: "expired",
      decision_contract: "AuthiChain Verification Decision v1",
      reasons: ["durable_status_expired"],
    });
  });

  it("maps durable revocation to revoked even when the signed decision was verified", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "revoked-route-kid";
    process.env.CRON_SECRET = "issuer-test-secret";
    const app = new Hono();
    registerJwksRoute(app);
    registerAttestationApi(app, registryFor("revoked"));
    const signed = await app.request("/api/v1/attestation", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer issuer-test-secret" },
      body: JSON.stringify(SAMPLE),
    });
    const { jws } = await signed.json() as { jws: string };
    const res = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "revoked",
      claim_status: "revoked",
      decision_contract: "AuthiChain Verification Decision v1",
      reasons: ["durable_status_revoked"],
    });
  });

  it("fails closed on an untrusted issuer", async () => {
    const { app, sign } = await setup();
    const untrusted = new Hono();
    registerJwksRoute(untrusted);
    registerAttestationApi(untrusted, registryFor(undefined, "suspended"));
    const res = await untrusted.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws: await sign() }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "indeterminate",
      decision_contract: "AuthiChain Verification Decision v1",
      reasons: ["issuer_not_trusted"],
    });
    void app;
  });

  it("does not invent a decision for a bad signature", async () => {
    const { app, sign } = await setup();
    const [h, p, sig] = (await sign()).split(".");
    const bytes = Buffer.from(sig, "base64url");
    bytes[0] ^= 1;
    const res = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws: [h, p, bytes.toString("base64url")].join(".") }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ valid: false });
  });
});