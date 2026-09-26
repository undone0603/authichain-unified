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
  issuer: { id: "https://authichain.govchain.us", name: "AuthiChain" },
  subject: { object_id: "authi:test:SN-1" },
  decision: "verified",
  status: "active",
  issued_at: "2026-09-19T00:00:00Z",
  evidence: [
    {
      id: "unit",
      type: "test",
      digest:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 = Buffer.from(
      pem,
      "utf8"
    ).toString("base64");
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
    expect(validateAttestation(SAMPLE).attestation_id).toBe(
      SAMPLE.attestation_id
    );

    const verified = await app.request("/api/v1/attestation", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws: body.jws }),
    });
    expect(verified.status).toBe(200);
    const check = (await verified.json()) as { valid: boolean };
    expect(check.valid).toBe(true);
  });

  it("GET /api/v1/attestation and aliases return the contract index", async () => {
    const app = new Hono();
    registerAttestationApi(app);
    for (const path of [
      "/api/v1/attestation",
      "/api/attest",
      "/api/attestations",
    ]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; canonical: string };
      expect(body.ok).toBe(true);
      expect(body.canonical).toBe("/api/v1/attestation");
    }
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

describe("verification reports the issuer's decision (docs/attestation/v0.1.md)", () => {
  afterEach(() => {
    delete process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
    delete process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
  });

  async function appWithKey() {
    const { privateKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 = Buffer.from(
      await exportPKCS8(privateKey),
      "utf8"
    ).toString("base64");
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "decision-kid";
    const app = new Hono();
    registerJwksRoute(app);
    registerAttestationApi(app);
    const sign = async (overrides: Record<string, unknown>) => {
      const res = await app.request("/api/v1/attestation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...SAMPLE, ...overrides }),
      });
      expect(res.status).toBe(200);
      return ((await res.json()) as { jws: string }).jws;
    };
    const verify = async (
      jws: string,
      path = "/api/v1/attestation/verify",
      extra = {}
    ) => {
      const res = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws, ...extra }),
      });
      return {
        status: res.status,
        body: (await res.json()) as Record<string, unknown>,
      };
    };
    return { app, sign, verify };
  }

  it("verified + active + unexpired is valid (200)", async () => {
    const { sign, verify } = await appWithKey();
    const r = await verify(await sign({}));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      valid: true,
      decision: "verified",
      status: "active",
      reasons: [],
    });
  });

  it.each(["blocked", "warning"])(
    "a %s decision is not valid (409), decision kept",
    async decision => {
      const { sign, verify } = await appWithKey();
      const r = await verify(await sign({ decision }));
      expect(r.status).toBe(409);
      expect(r.body).toMatchObject({
        valid: false,
        decision,
        status: "active",
        signature: "valid",
      });
      expect(r.body.reasons).toEqual([`decision_${decision}`]);
    }
  );

  it("a revoked attestation stays inspectable instead of erroring", async () => {
    const { sign, verify } = await appWithKey();
    const r = await verify(
      await sign({ status: "revoked", decision: "blocked" })
    );
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({
      valid: false,
      status: "revoked",
      decision: "blocked",
    });
  });

  it("an expired attestation reports status expired", async () => {
    const { sign, verify } = await appWithKey();
    const r = await verify(
      await sign({
        issued_at: "2026-01-01T00:00:00Z",
        expires_at: "2026-02-01T00:00:00Z",
      })
    );
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({
      valid: false,
      status: "expired",
      expired: true,
    });
  });

  it("a tampered signature is 400, not a decision", async () => {
    const { sign, verify } = await appWithKey();
    const [h, p, sig] = (await sign({})).split(".");
    const flipped = sig.slice(0, -2) + (sig.endsWith("A") ? "BB" : "AA");
    const r = await verify([h, p, flipped].join("."));
    expect(r.status).toBe(400);
    expect(r.body.valid).toBe(false);
  });

  it("checks the subject against the object in hand when asked", async () => {
    const { sign, verify } = await appWithKey();
    const jws = await sign({});
    expect(
      (
        await verify(jws, "/api/v1/attestation/verify", {
          expected_object_id: "authi:test:SN-1",
        })
      ).status
    ).toBe(200);
    const other = await verify(jws, "/api/v1/attestation/verify", {
      expected_object_id: "authi:test:SN-2",
    });
    expect(other.status).toBe(400);
  });

  it("the documented /api/v1/attestations/verify path and PUT give the same answer", async () => {
    const { app, sign, verify } = await appWithKey();
    const jws = await sign({ decision: "blocked" });
    expect((await verify(jws, "/api/v1/attestations/verify")).status).toBe(409);
    const put = await app.request("/api/v1/attestation", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws }),
    });
    expect(put.status).toBe(409);
    expect(((await put.json()) as { valid: boolean }).valid).toBe(false);
  });
});
