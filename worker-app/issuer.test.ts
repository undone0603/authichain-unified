// @vitest-environment node
import { describe, expect, it, afterEach } from "vitest";
import { Hono } from "hono";
import { exportPKCS8, generateKeyPair } from "jose";
import { verifyAttestationJws } from "../packages/verifier/src/index";
import { registerIssuerRoutes } from "./issuer";
import { registerJwksRoute } from "./jwks";

describe("registerIssuerRoutes", () => {
  afterEach(() => {
    delete process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
    delete process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
    delete process.env.AUTHICHAIN_ATTESTATION_PUBLIC_JWK;
    delete process.env.CRON_SECRET;
  });

  async function bindKey() {
    const { privateKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const pem = await exportPKCS8(privateKey);
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 =
      Buffer.from(pem, "utf8").toString("base64");
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "issuer-test-kid";
    process.env.CRON_SECRET = "cron-test-secret";
  }

  it("returns 503 when the attestation key is missing", async () => {
    const app = new Hono();
    registerIssuerRoutes(app);
    const res = await app.request("/protocol/issuer.json");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ready: boolean };
    expect(body.ready).toBe(false);
  });

  it("reports ready + signing when the production key is bound", async () => {
    await bindKey();
    const app = new Hono();
    registerIssuerRoutes(app);
    const res = await app.request("/protocol/issuer.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const body = (await res.json()) as {
      ready: boolean;
      signing: boolean;
      kid: string;
      alg: string;
    };
    expect(body.ready).toBe(true);
    expect(body.signing).toBe(true);
    expect(body.kid).toBe("issuer-test-kid");
    expect(body.alg).toBe("EdDSA");
  });

  it("rejects unauthenticated launch-proof requests", async () => {
    await bindKey();
    const app = new Hono();
    registerIssuerRoutes(app);
    const res = await app.request("/protocol/launch-proof", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects a launch-proof request with the wrong bearer secret", async () => {
    await bindKey();
    const app = new Hono();
    registerIssuerRoutes(app);
    const res = await app.request("/protocol/launch-proof", {
      method: "POST",
      headers: { authorization: "Bearer wrong", "content-type": "application/json" },
      body: JSON.stringify({ subject: { object_id: "authi:ref" } }),
    });
    expect(res.status).toBe(401);
  });

  it("signs a constrained launch attestation that verifies against JWKS", async () => {
    await bindKey();
    const app = new Hono();
    registerJwksRoute(app);
    registerIssuerRoutes(app);

    const signed = await app.request("/protocol/launch-proof", {
      method: "POST",
      headers: {
        authorization: "Bearer cron-test-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        runId: "35404665209",
        gitSha: "cdc947084e69b4d79af7cd301d84e135b0919be4",
        subject: {
          object_id: "authi:reference-object",
          serial: "SN-001",
          gtin: "01234567890128",
        },
      }),
    });
    expect(signed.status).toBe(200);
    const body = (await signed.json()) as {
      jws: string;
      kid: string;
      source: string;
      via: string;
    };
    expect(body.kid).toBe("issuer-test-kid");
    expect(body.source).toBe("authichain-edge-router");
    expect(body.via).toBe("cron");
    expect(body.jws.split(".")).toHaveLength(3);

    const jwks = await app.request("/protocol/jwks.json");
    const jwksBody = (await jwks.json()) as {
      keys: Array<Record<string, unknown>>;
    };
    const verified = await verifyAttestationJws(body.jws, jwksBody.keys[0], {
      expectedObjectId: "authi:reference-object",
    });
    expect(verified.version).toBe("0.1");
    expect(verified.decision).toBe("verified");
    expect(verified.status).toBe("active");
    expect(verified.attestation_id).toBe(
      "urn:authichain:attestation:v01:launch-35404665209",
    );
  });

  it("requires subject.object_id", async () => {
    await bindKey();
    const app = new Hono();
    registerIssuerRoutes(app);
    const res = await app.request("/protocol/launch-proof", {
      method: "POST",
      headers: {
        authorization: "Bearer cron-test-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ runId: "1" }),
    });
    expect(res.status).toBe(400);
  });
});
