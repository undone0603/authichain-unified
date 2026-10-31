// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { CompactSign, exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { registerAttestationApi, type AttestationRegistry } from "./attestation-api";
import { registerJwksRoute, resolveVerificationKeys, selectVerificationKey } from "./jwks";
import { canonicalize, AUTHICHAIN_ATTESTATION_TYP } from "../packages/verifier/src/index";

/**
 * Key rotation must not be destructive. Before this, the verifier trusted
 * exactly one key, so rotating the signing key turned every attestation it had
 * issued into `indeterminate` and made them impossible to revoke.
 */

const ENV_KEYS = [
  "AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64",
  "AUTHICHAIN_ATTESTATION_KEY_ID",
  "AUTHICHAIN_ATTESTATION_PUBLIC_JWK",
  "AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS",
  "CRON_SECRET",
] as const;

const SAMPLE = {
  version: "0.1",
  attestation_id: "urn:authichain:attestation:v01:rotation-1",
  issuer: { id: "https://authichain.com", name: "AuthiChain" },
  subject: { object_id: "authi:test:ROT-1" },
  decision: "verified",
  status: "active",
  issued_at: "2026-09-19T00:00:00Z",
  evidence: [
    {
      id: "unit",
      type: "test",
      digest: "sha256:" + "b".repeat(64),
    },
  ],
};

function registry(): AttestationRegistry {
  const statuses = new Map<string, { claimStatus: "revoked" | "superseded"; eventId: string; issuerId: string; attestationId: string; effectiveAt: string }>();
  let n = 0;
  return {
    getCurrentStatus: async (_env, id) => ({ ok: true as const, status: statuses.get(id) ?? null }),
    getIssuer: async (_env, issuerId) => ({
      ok: true as const,
      issuer: {
        issuerId,
        organization: "AuthiChain",
        issuerType: "service" as const,
        jwksUri: "https://authichain.com/protocol/jwks.json",
        status: "trusted" as const,
        validFrom: "2026-01-01T00:00:00Z",
      },
    }),
    recordStatusEvent: async (_env, input) => {
      const eventId = "urn:authichain:event:v01:rot-" + ++n;
      statuses.set(input.attestationId, {
        attestationId: input.attestationId,
        claimStatus: input.eventType === "attestation.superseded" ? "superseded" : "revoked",
        eventId,
        issuerId: input.issuerId,
        effectiveAt: new Date().toISOString(),
      });
      return { ok: true as const, eventId };
    },
  };
}

async function keypair(kid: string) {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const pemB64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
  const publicJwk = { ...(await exportJWK(publicKey)), kid };
  return { kid, privateKey, pemB64, publicJwk };
}

function bindCurrent(k: { kid: string; pemB64: string }) {
  process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 = k.pemB64;
  process.env.AUTHICHAIN_ATTESTATION_KEY_ID = k.kid;
}

async function signWith(k: { kid: string; privateKey: CryptoKey }, attestation: Record<string, unknown> = SAMPLE) {
  return new CompactSign(new TextEncoder().encode(canonicalize(attestation as never)))
    .setProtectedHeader({ alg: "EdDSA", kid: k.kid, typ: AUTHICHAIN_ATTESTATION_TYP })
    .sign(k.privateKey);
}

function app() {
  const a = new Hono();
  registerJwksRoute(a);
  const reg = registry();
  registerAttestationApi(a, reg);
  return a;
}

const json = (body: unknown, auth?: string) => ({
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(auth ? { authorization: `Bearer ${auth}` } : {}),
  },
  body: JSON.stringify(body),
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("attestation key rotation", () => {
  it("still verifies an attestation signed by a retired key, and says so", async () => {
    const oldKey = await keypair("kid-2026-01");
    const newKey = await keypair("kid-2026-10");
    const jws = await signWith(oldKey);
    bindCurrent(newKey);
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = JSON.stringify([oldKey.publicJwk]);

    const res = await app().request("/api/v1/attestation/verify", json({ jws }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.valid).toBe(true);
    expect(body.decision).toBe("verified");
    expect(body.trust.evidence).toMatchObject({ kid: "kid-2026-01", key_status: "retired" });
  });

  it("without the retired key, the same attestation is indeterminate, not counterfeit", async () => {
    const oldKey = await keypair("kid-2026-01");
    const newKey = await keypair("kid-2026-10");
    const jws = await signWith(oldKey);
    bindCurrent(newKey);

    const res = await app().request("/api/v1/attestation/verify", json({ jws }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "indeterminate",
      error: "attestation JWS kid is not a known verification key",
    });
  });

  it("a forged JWS naming a retired kid fails the signature check", async () => {
    const oldKey = await keypair("kid-2026-01");
    const newKey = await keypair("kid-2026-10");
    const attacker = await keypair("kid-2026-01");
    bindCurrent(newKey);
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = JSON.stringify([oldKey.publicJwk]);
    const forged = await signWith(attacker);

    const res = await app().request("/api/v1/attestation/verify", json({ jws: forged }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ valid: false, decision: "indeterminate", cryptographic_status: "invalid" });
  });

  it("PUT verify works with only public key material bound (no private key)", async () => {
    const k = await keypair("kid-public-only");
    const jws = await signWith(k);
    process.env.AUTHICHAIN_ATTESTATION_PUBLIC_JWK = JSON.stringify(k.publicJwk);
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = k.kid;

    const res = await app().request("/api/v1/attestation", { ...json({ jws }), method: "PUT" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: true, decision: "verified" });
  });

  it("can revoke an attestation signed by a retired key", async () => {
    const oldKey = await keypair("kid-2026-01");
    const newKey = await keypair("kid-2026-10");
    const jws = await signWith(oldKey);
    bindCurrent(newKey);
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = JSON.stringify([oldKey.publicJwk]);
    process.env.CRON_SECRET = "issuer-secret";
    const a = app();

    const revoke = await a.request(
      `/api/v1/attestations/${encodeURIComponent(SAMPLE.attestation_id)}/revoke`,
      json({ jws, reason_code: "key_rotated_compromise_check" }, "issuer-secret"),
    );
    expect(revoke.status).toBe(200);
    const verify = await a.request("/api/v1/attestation/verify", json({ jws }));
    expect(verify.status).toBe(409);
    expect(await verify.json()).toMatchObject({ valid: false, decision: "revoked" });
  });

  it("refuses to supersede onto a replacement signed by a retired key", async () => {
    const oldKey = await keypair("kid-2026-01");
    const newKey = await keypair("kid-2026-10");
    bindCurrent(newKey);
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = JSON.stringify([oldKey.publicJwk]);
    process.env.CRON_SECRET = "issuer-secret";
    const original = await signWith(newKey);
    const replacement = await signWith(oldKey, {
      ...SAMPLE,
      attestation_id: "urn:authichain:attestation:v01:rotation-2",
    });

    const res = await app().request(
      `/api/v1/attestations/${encodeURIComponent(SAMPLE.attestation_id)}/supersede`,
      json({ jws: original, replacement_jws: replacement }, "issuer-secret"),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "replacement must be signed by the current key" });
  });

  it("JWKS publishes the current key first, then retired keys, never private material", async () => {
    const oldKey = await keypair("kid-2026-01");
    const newKey = await keypair("kid-2026-10");
    bindCurrent(newKey);
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = JSON.stringify([oldKey.publicJwk]);

    const res = await app().request("/.well-known/jwks.json");
    expect(res.status).toBe(200);
    const { keys } = (await res.json()) as { keys: Array<Record<string, unknown>> };
    expect(keys.map(k => k.kid)).toEqual(["kid-2026-10", "kid-2026-01"]);
    for (const k of keys) {
      expect(k.d).toBeUndefined();
      expect(k.key_status).toBeUndefined();
    }
  });
});

describe("verification is observable", () => {
  it("emits attestation.verified and attestation.rejected trust events without the JWS", async () => {
    const oldKey = await keypair("kid-2026-01");
    const newKey = await keypair("kid-2026-10");
    bindCurrent(newKey);
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = JSON.stringify([oldKey.publicJwk]);
    const good = await signWith(oldKey);
    const unknown = await signWith(await keypair("kid-unknown"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const a = app();
      await a.request("/api/v1/attestation/verify", json({ jws: good }));
      await a.request("/api/v1/attestation/verify", json({ jws: unknown }));
      const events = log.mock.calls
        .map(c => String(c[0]))
        .filter(l => l.includes("authichain.trust-event/1"))
        .map(l => JSON.parse(l));
      expect(events).toEqual([
        expect.objectContaining({
          event: "attestation.verified",
          attestation_id: SAMPLE.attestation_id,
          kid: "kid-2026-01",
          key_status: "retired",
          decision: "verified",
          http_status: 200,
        }),
        expect.objectContaining({ event: "attestation.rejected", decision: "indeterminate", http_status: 400 }),
      ]);
      const raw = log.mock.calls.map(c => String(c[0])).join(String.fromCharCode(10));
      expect(raw).not.toContain(good);
      expect(raw).not.toContain(unknown);
    } finally {
      log.mockRestore();
    }
  });
});

describe("retired key configuration fails closed", () => {
  it("drops entries with private material, no kid, a non-Ed25519 curve, or a kid that shadows the current key", async () => {
    const current = await keypair("kid-current");
    const good = await keypair("kid-good");
    bindCurrent(current);
    const leaked = { ...good.publicJwk, kid: "kid-leaked", d: "private" };
    const noKid = { ...good.publicJwk, kid: undefined };
    const wrongCurve = { ...good.publicJwk, kid: "kid-x448", crv: "X448" };
    const shadow = { ...good.publicJwk, kid: "kid-current" };
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = JSON.stringify([
      leaked,
      noKid,
      wrongCurve,
      shadow,
      good.publicJwk,
    ]);

    const resolved = await resolveVerificationKeys();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.keys.map(k => [k.kid, k.key_status])).toEqual([
      ["kid-current", "current"],
      ["kid-good", "retired"],
    ]);
  });

  it("ignores the whole list when it is not valid JSON", async () => {
    const current = await keypair("kid-current");
    bindCurrent(current);
    process.env.AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS = "[{not json";
    const resolved = await resolveVerificationKeys();
    expect(resolved.ok && resolved.keys.map(k => k.kid)).toEqual(["kid-current"]);
  });

  it("selectVerificationKey rejects a malformed header and a missing kid", async () => {
    const current = await keypair("kid-current");
    bindCurrent(current);
    const resolved = await resolveVerificationKeys();
    if (!resolved.ok) throw new Error("expected keys");
    expect(selectVerificationKey("%%%.x.y", resolved.keys)).toEqual({ ok: false, error: "invalid compact JWS header" });
    const noKid = Buffer.from(JSON.stringify({ alg: "EdDSA" })).toString("base64url") + ".x.y";
    expect(selectVerificationKey(noKid, resolved.keys)).toEqual({ ok: false, error: "attestation JWS kid is required" });
  });
});
