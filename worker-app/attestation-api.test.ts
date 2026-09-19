// @vitest-environment node
import { describe, expect, it, afterEach } from "vitest";
import { Hono } from "hono";
import { exportPKCS8, generateKeyPair } from "jose";
import { registerAttestationApi } from "./attestation-api";
import { registerJwksRoute } from "./jwks";
import { validateAttestation } from "../packages/verifier/src/index";

const SAMPLE = {
  version: "0.1",
  attestation_id: "urn:authichain:attestation:v01:test-1",
  issuer: { id: "https://authichain.com", name: "AuthiChain" },
  subject: { object_id: "authi:test:SN-1" },
  decision: "verified",
  status: "active",
  issued_at: "2026-09-19T00:00:00Z",
  evidence: [
    {
      id: "unit",
      type: "test",
      digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ],
};

describe("registerAttestationApi", () => {
  afterEach(() => {
    delete process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
    delete process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
    delete process.env.AUTHICHAIN_ATTESTATION_PUBLIC_JWK;
  });

  async function bindKey() {
    const { privateKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const pem = await exportPKCS8(privateKey);
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 =
      Buffer.from(pem, "utf8").toString("base64");
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "attest-api-kid";
  }

  it("POST signs a valid attestation and PUT verifies it", async () => {
    await bindKey();
    const app = new Hono();
    registerJwksRoute(app);
    registerAttestationApi(app);

    const signed = await app.request("/api/v1/attestation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SAMPLE),
    });
    expect(signed.status).toBe(200);
    const body = (await signed.json()) as { jws: string; kid: string };
    expect(body.jws).toBeTruthy();
    expect(body.kid).toBe("attest-api-kid");
    expect(validateAttestation(SAMPLE).attestation_id).toBe(SAMPLE.attestation_id);

    const verified = await app.request("/api/v1/attestation", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws: body.jws }),
    });
    expect(verified.status).toBe(200);
    const check = (await verified.json()) as { valid: boolean };
    expect(check.valid).toBe(true);
  });

  it("POST /api/v1/attestation/verify rejects a missing jws", async () => {
    const app = new Hono();
    registerAttestationApi(app);
    const res = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { valid: boolean };
    expect(body.valid).toBe(false);
  });
});
