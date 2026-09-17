import { describe, expect, it, afterEach } from "vitest";
import { Hono } from "hono";
import { exportPKCS8, generateKeyPair } from "jose";
import { registerJwksRoute } from "./jwks";

describe("registerJwksRoute", () => {
  afterEach(() => {
    delete process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
    delete process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
  });

  it("returns 503 when the attestation key is missing", async () => {
    const app = new Hono();
    registerJwksRoute(app);
    const res = await app.request("/.well-known/jwks.json");
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "attestation key unavailable",
    });
  });

  it("returns a public Ed25519 JWK and never the private d", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const pem = await exportPKCS8(privateKey);
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 =
      Buffer.from(pem).toString("base64");
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "test-kid";

    const app = new Hono();
    registerJwksRoute(app);
    const res = await app.request("/.well-known/jwks.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/json/);
    const body = (await res.json()) as {
      keys: Array<Record<string, unknown>>;
    };
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].kty).toBe("OKP");
    expect(body.keys[0].crv).toBe("Ed25519");
    expect(body.keys[0].alg).toBe("EdDSA");
    expect(body.keys[0].use).toBe("sig");
    expect(body.keys[0].kid).toBe("test-kid");
    expect(body.keys[0].d).toBeUndefined();
    expect(typeof body.keys[0].x).toBe("string");
  });
});
