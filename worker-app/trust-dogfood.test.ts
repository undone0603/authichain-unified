/**
 * Dogfood: AuthiChain attests AuthiChain, then consumes its own verify API.
 *
 * Real Ed25519 keys, real JWS, real registry mock for durable lifecycle,
 * real decision contract. No mocked verifyResponse / resolveVerificationDecision.
 */
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { exportPKCS8, generateKeyPair } from "jose";
import {
  registerAttestationApi,
  type AttestationRegistry,
} from "./attestation-api";
import { registerJwksRoute } from "./jwks";
import { resolveVerificationDecision } from "../packages/verifier/src/verification-decision";
import { verticalMayActOnVerified } from "../src/lib/vertical-verification";

const DOGFOOD = {
  version: "0.1",
  attestation_id: "urn:authichain:attestation:v01:dogfood-self",
  issuer: { id: "https://authichain.com", name: "AuthiChain" },
  subject: {
    object_id: "authi:software:authichain-unified",
    product_class: "software_release",
    serial: "trust-completion-spine",
  },
  decision: "verified",
  status: "active",
  issued_at: "2026-10-12T00:00:00Z",
  evidence: [
    {
      id: "repo-commit",
      type: "git_commit",
      digest:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
    {
      id: "build-artifact",
      type: "build",
      digest:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    },
  ],
};

function dogfoodRegistry(): AttestationRegistry & {
  statuses: Map<string, { claimStatus: "active" | "revoked" | "expired" | "superseded"; eventId: string }>;
} {
  const statuses = new Map<
    string,
    {
      attestationId: string;
      claimStatus: "active" | "revoked" | "expired" | "superseded";
      effectiveAt: string;
      issuerId: string;
      eventId: string;
      reasonCode?: string;
    }
  >();
  let seq = 0;
  return {
    statuses: statuses as never,
    getCurrentStatus: async (_env, attestationId) => ({
      ok: true as const,
      status: statuses.get(attestationId) ?? null,
    }),
    getIssuer: async (_env, issuerId) => ({
      ok: true as const,
      issuer: {
        issuerId,
        organization: "AuthiChain",
        issuerType: "service" as const,
        jwksUri: "https://authichain.com/.well-known/jwks.json",
        status: "trusted" as const,
        validFrom: "2026-01-01T00:00:00Z",
      },
    }),
    recordStatusEvent: async (_env, input) => {
      const eventId = `urn:authichain:event:dogfood:${++seq}`;
      statuses.set(input.attestationId, {
        attestationId: input.attestationId,
        claimStatus:
          input.eventType === "attestation.revoked"
            ? "revoked"
            : input.eventType === "attestation.superseded"
              ? "superseded"
              : "active",
        effectiveAt: new Date().toISOString(),
        issuerId: input.issuerId,
        eventId,
        ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      });
      return { ok: true as const, eventId };
    },
  };
}

describe("AuthiChain dogfood trust chain", () => {
  afterEach(() => {
    delete process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
    delete process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
    delete process.env.CRON_SECRET;
  });

  async function boot() {
    const { privateKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 = Buffer.from(
      await exportPKCS8(privateKey),
      "utf8",
    ).toString("base64");
    process.env.AUTHICHAIN_ATTESTATION_KEY_ID = "dogfood-kid";
    process.env.CRON_SECRET = "dogfood-issuer-secret";
    const registry = dogfoodRegistry();
    const app = new Hono();
    registerJwksRoute(app);
    registerAttestationApi(app, registry);
    return { app, registry };
  }

  it("issues → verifies → authorizes → revokes → denies → rejects forgery", async () => {
    const { app } = await boot();

    // 1. CREATE / ISSUE attestation for AuthiChain itself
    const issued = await app.request("/api/v1/attestation", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer dogfood-issuer-secret",
      },
      body: JSON.stringify(DOGFOOD),
    });
    expect(issued.status).toBe(200);
    const { jws } = (await issued.json()) as { jws: string };
    expect(jws.split(".")).toHaveLength(3);

    // 2. VERIFY — cryptographically valid + active → authorized
    const verified = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jws,
        expected_object_id: DOGFOOD.subject.object_id,
      }),
    });
    expect(verified.status).toBe(200);
    const verifiedBody = (await verified.json()) as Record<string, unknown>;
    expect(verifiedBody).toMatchObject({
      valid: true,
      decision: "verified",
      decision_contract: "AuthiChain Verification Decision v1",
      trust: {
        policy: { authorized: true },
        decision: { code: "verified", valid: true },
      },
    });
    expect(
      verticalMayActOnVerified(
        verifiedBody as { valid: boolean; decision: string },
      ),
    ).toBe(true);

    // 3. AgentZ-style capability gate: only after positive verification
    const agentAuthorized =
      verifiedBody.decision === "verified" &&
      verifiedBody.valid === true &&
      new Set(["publish_dpp", "bind_qron"]).has("publish_dpp");
    expect(agentAuthorized).toBe(true);
    const agentEscalation =
      verifiedBody.decision === "verified" &&
      verifiedBody.valid === true &&
      new Set(["publish_dpp"]).has("transfer_funds");
    expect(agentEscalation).toBe(false);

    // 4. REVOKE durable lifecycle (requires the signed JWS as evidence)
    const revoked = await app.request(
      `/api/v1/attestations/${encodeURIComponent(DOGFOOD.attestation_id)}/revoke`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer dogfood-issuer-secret",
        },
        body: JSON.stringify({ jws, reason_code: "dogfood_revoke" }),
      },
    );
    expect(revoked.status).toBe(200);

    // 5. VERIFY AGAIN — same signature, lifecycle revoked → unauthorized
    const afterRevoke = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws }),
    });
    expect(afterRevoke.status).toBe(409);
    const revokedBody = (await afterRevoke.json()) as Record<string, unknown>;
    expect(revokedBody).toMatchObject({
      valid: false,
      decision: "revoked",
      claim_status: "revoked",
      cryptographic_status: "valid",
      trust: { policy: { authorized: false } },
    });
    // Cryptographically valid ≠ authorized
    expect(revokedBody.signature).toBe("valid");
    expect(revokedBody.valid).toBe(false);

    // 6. FORGED signature fails closed (400, no invented decision)
    const [h, p, sig] = jws.split(".");
    const bytes = Buffer.from(sig, "base64url");
    bytes[0] ^= 0x01;
    const forged = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jws: [h, p, bytes.toString("base64url")].join("."),
      }),
    });
    expect(forged.status).toBe(400);
    expect((await forged.json()) as { valid: boolean }).toMatchObject({
      valid: false,
    });

    // 7. NOT FOUND ≠ COUNTERFEIT (pure decision resolver)
    expect(
      resolveVerificationDecision({
        cryptographicValid: true,
        issuerTrusted: true,
        claimStatus: "active",
        signedDecision: "verified",
        expired: false,
        found: false,
      }),
    ).toEqual({
      decision: "not_found",
      valid: false,
      reasons: ["identifier_or_attestation_not_found"],
    });
  });

  it("expired and risk-flagged attestations remain unauthorized", async () => {
    const { app } = await boot();
    const issued = await app.request("/api/v1/attestation", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer dogfood-issuer-secret",
      },
      body: JSON.stringify({
        ...DOGFOOD,
        attestation_id: "urn:authichain:attestation:v01:dogfood-expired",
        issued_at: "2026-01-01T00:00:00Z",
        expires_at: "2026-02-01T00:00:00Z",
      }),
    });
    const { jws } = (await issued.json()) as { jws: string };

    const expired = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jws }),
    });
    expect(expired.status).toBe(409);
    expect(await expired.json()).toMatchObject({
      decision: "expired",
      valid: false,
      trust: { policy: { authorized: false } },
    });

    const live = await app.request("/api/v1/attestation", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer dogfood-issuer-secret",
      },
      body: JSON.stringify({
        ...DOGFOOD,
        attestation_id: "urn:authichain:attestation:v01:dogfood-risk",
      }),
    });
    const liveJws = ((await live.json()) as { jws: string }).jws;
    const risk = await app.request("/api/v1/attestation/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jws: liveJws,
        risk_signals: ["cloned_serial", "impossible_travel"],
      }),
    });
    expect(risk.status).toBe(409);
    expect(await risk.json()).toMatchObject({
      decision: "risk",
      valid: false,
      reasons: ["risk_cloned_serial", "risk_impossible_travel"],
      trust: { risk: { flagged: true }, policy: { authorized: false } },
    });
  });
});
