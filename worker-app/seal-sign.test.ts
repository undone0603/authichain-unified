// @vitest-environment node
import { describe, expect, it, afterEach } from "vitest";
import { Hono } from "hono";
import { decodeProtectedHeader, exportJWK, exportPKCS8, generateKeyPair, compactVerify } from "jose";
import { registerIssuerRoutes, OWN_SEAL_PRODUCT, type SealRow } from "./issuer";

const SEED = "s".repeat(40);

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 = Buffer.from(await exportPKCS8(privateKey)).toString("base64");
  process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "seal-test-kid";
  process.env.SEAL_SEED_TOKEN = SEED;
  const rows: SealRow[] = [];
  const app = new Hono();
  registerIssuerRoutes(app, { insertSeal: async row => { rows.push(row); return { ok: true }; } });
  return { app, rows, publicKey };
}

const post = (app: Hono, body: unknown, token = SEED) =>
  app.request("/protocol/seal-sign", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

afterEach(() => {
  delete process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
  delete process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
  delete process.env.SEAL_SEED_TOKEN;
  delete process.env.CRON_SECRET;
});

describe("POST /protocol/seal-sign", () => {
  it("rejects missing and wrong bearer", async () => {
    const { app, rows } = await setup();
    expect((await app.request("/protocol/seal-sign", { method: "POST" })).status).toBe(401);
    expect((await post(app, { product_id: "authichain-x", label: "l" }, "nope")).status).toBe(401);
    expect(rows).toHaveLength(0);
  });

  it("ignores a short seed token", async () => {
    const { app } = await setup();
    process.env.SEAL_SEED_TOKEN = "short";
    expect((await post(app, { product_id: "authichain-demo", label: "l" }, "short")).status).toBe(401);
  });

  it("only signs AuthiChain-owned product ids", async () => {
    const { app, rows } = await setup();
    expect((await post(app, { product_id: "acme-widget", label: "l" })).status).toBe(400);
    expect((await post(app, { product_id: "authichain-demo" })).status).toBe(400);
    expect(rows).toHaveLength(0);
    expect(OWN_SEAL_PRODUCT.test("authichain-is-this-real-demo")).toBe(true);
  });

  it("signs with the worker key, stores the row, returns JWS + kid only", async () => {
    const { app, rows, publicKey } = await setup();
    const res = await post(app, { product_id: "authichain-is-this-real-demo", label: "AuthiChain demo seal" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, string>;
    expect(body.kid).toBe("seal-test-kid");
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE|BEGIN/);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.id).toBe(body.seal_id);
    expect(row.brand).toBe("authichain.com");
    expect(row.signing_kid).toBe("seal-test-kid");
    expect(decodeProtectedHeader(row.signature_jws).kid).toBe("seal-test-kid");
    const { payload } = await compactVerify(row.signature_jws, publicKey);
    const att = JSON.parse(new TextDecoder().decode(payload));
    expect(att.subject.object_id).toBe(`urn:authichain:seal:${row.id}`);
    expect(att.subject.serial).toBe("authichain-is-this-real-demo");
    void exportJWK;
  });

  it("returns 502 and no seal id when the insert fails", async () => {
    await setup();
    const app = new Hono();
    registerIssuerRoutes(app, { insertSeal: async () => ({ ok: false, error: "insert 500" }) });
    const res = await post(app, { product_id: "authichain-demo", label: "l" });
    expect(res.status).toBe(502);
    expect(((await res.json()) as Record<string, unknown>).seal_id).toBeUndefined();
  });
});
