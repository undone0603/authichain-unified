import type { Hono } from "hono";
import { importPKCS8 } from "jose";
import {
  evaluateAttestation,
  inspectAttestationJws,
  publicJwkFromPrivateKey,
  signAttestation,
  validateAttestation,
} from "../packages/verifier/src/index";
import { resolveAttestationKey, type AttestationEnv } from "./jwks";
import { authorizeIssuerRequest, type IssuerEnv } from "./issuer";
import { getCurrentAttestationStatus, getIssuer, recordStatusEvent, type AttestationRegistryEnv } from "./attestation-registry";

const NO_STORE = { "Cache-Control": "private, no-store" };

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function loadPrivateKey(env?: AttestationEnv) {
  const resolved = await resolveAttestationKey(env);
  if (!resolved.ok || !resolved.key.privatePem) {
    throw new Error("attestation signing key unavailable");
  }
  const privateKey = await importPKCS8(resolved.key.privatePem, "EdDSA");
  return {
    privateKey,
    kid: resolved.key.kid,
    publicJwk: resolved.key.publicJwk,
  };
}

/**
 * The consumer-facing verification contract (docs/attestation/v0.1.md): a
 * signature failure is 400; a good signature returns the attestation with its
 * decision and status preserved, and valid=true (200) only when it is
 * verified, active and unexpired, otherwise valid=false (409). Before this,
 * any active, unexpired attestation came back valid=true, including ones the
 * issuer marked `blocked` or `warning`, and a revoked one lost its decision.
 */
function hasJws(body: unknown): boolean {
  const jws = (body as Record<string, unknown> | null)?.jws;
  return typeof jws === "string" && jws.trim().length > 0;
}

async function verifyResponse(
  body: unknown,
  publicJwk: Record<string, unknown>
): Promise<{ status: 200 | 400 | 409; payload: Record<string, unknown> }> {
  const input = (body ?? {}) as Record<string, unknown>;
  const jws = input.jws;
  if (typeof jws !== "string" || !jws.trim()) {
    return { status: 400, payload: { valid: false, error: "jws is required" } };
  }
  const expected = input.expected_object_id ?? input.expectedObjectId;
  let attestation;
  try {
    attestation = await inspectAttestationJws(jws.trim(), publicJwk, {
      expectedObjectId: typeof expected === "string" ? expected : undefined,
    });
  } catch (error) {
    return {
      status: 400,
      payload: {
        valid: false,
        error: error instanceof Error ? error.message : "invalid signature",
      },
    };
  }
  const evaluation = evaluateAttestation(attestation);
  return {
    status: evaluation.valid ? 200 : 409,
    payload: {
      valid: evaluation.valid,
      contract: "AuthiChain Attestation Contract",
      version: "0.1",
      decision: evaluation.decision,
      status: evaluation.status,
      expired: evaluation.expired,
      reasons: evaluation.reasons,
      signature: "valid",
      attestation,
    },
  };
}

const ATTESTATION_INDEX = {
  ok: true,
  contract: "AuthiChain Attestation Contract",
  version: "0.1",
  methods: {
    POST: "sign a v0.1 attestation",
    PUT: "verify a compact JWS",
    "POST /verify": "verify a compact JWS",
  },
  jwks: "/.well-known/jwks.json",
  canonical: "/api/v1/attestation",
};

export function registerAttestationApi<
  E extends AttestationEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  const rewrite = (
    c: { req: { url: string; raw: Request }; env: E },
    path: string
  ) => {
    const url = new URL(c.req.url);
    url.pathname = path;
    return app.fetch(new Request(url.toString(), c.req.raw), c.env);
  };

  app.get("/api/v1/attestation", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));
  app.get("/api/attest", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));
  app.get("/api/attestations", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));

  app.get("/api/v1/attestations/:id/status", async c => {
    const attestationId = decodeURIComponent(c.req.param("id"));
    const result = await getCurrentAttestationStatus(c.env as AttestationRegistryEnv, attestationId);
    if (!result.ok) return c.json({ error: result.error }, result.status, NO_STORE);
    return c.json({
      attestation_id: attestationId,
      claim_status: result.status?.claimStatus ?? "active",
      status: result.status,
      durable: true,
    }, 200, NO_STORE);
  });

  app.post("/api/v1/attestations/:id/revoke", async c => {
    const auth = await authorizeIssuerRequest(
      c.req.header("authorization"),
      c.env as IssuerEnv,
    );
    if (!auth.ok) return c.json({ error: auth.error }, 401, NO_STORE);

    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.jws !== "string" || !body.jws.trim()) {
      return c.json({ error: "jws is required" }, 400, NO_STORE);
    }
    const reasonCode =
      typeof body.reason_code === "string" ? body.reason_code.trim().slice(0, 120) : undefined;

    let publicJwk: Record<string, unknown>;
    try {
      ({ publicJwk } = await loadPrivateKey(c.env));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "key unavailable" }, 503, NO_STORE);
    }

    let attestation;
    try {
      attestation = await inspectAttestationJws(body.jws.trim(), publicJwk);
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : "invalid signature",
      }, 400, NO_STORE);
    }

    const attestationId = decodeURIComponent(c.req.param("id"));
    if (attestation.attestation_id !== attestationId) {
      return c.json({ error: "attestation id does not match jws" }, 400, NO_STORE);
    }

    const issuerId = attestation.issuer.id;
    const issuer = await getIssuer(c.env as AttestationRegistryEnv, issuerId);
    if (!issuer.ok) return c.json({ error: issuer.error }, issuer.status, NO_STORE);
    if (issuer.issuer.status === "retired") {
      return c.json({ error: "issuer retired" }, 403, NO_STORE);
    }

    const subjectHash = `sha256:${await sha256Hex(JSON.stringify(attestation.subject))}`;
    const evidenceDigest =
      Array.isArray(attestation.evidence) && typeof attestation.evidence[0]?.digest === "string"
        ? attestation.evidence[0].digest
        : undefined;

    const event = await recordStatusEvent(c.env as AttestationRegistryEnv, {
      eventType: "attestation.revoked",
      attestationId,
      issuerId,
      ...(reasonCode ? { reasonCode } : {}),
      subjectHash,
      ...(evidenceDigest ? { evidenceDigest } : {}),
    });
    if (!event.ok) return c.json({ error: event.error }, event.status, NO_STORE);

    return c.json({
      attestation_id: attestationId,
      claim_status: "revoked",
      event_id: event.eventId,
      issuer_id: issuerId,
      reason_code: reasonCode,
    }, 200, NO_STORE);
  });

  app.post("/api/attest", c => rewrite(c, "/api/v1/attestation"));
  app.put("/api/attest", c => rewrite(c, "/api/v1/attestation"));
  app.post("/api/attestations", c => rewrite(c, "/api/v1/attestation"));
  app.put("/api/attestations", c => rewrite(c, "/api/v1/attestation"));
  app.post("/api/attest/verify", c => rewrite(c, "/api/v1/attestation/verify"));
  app.post("/api/attestations/verify", c =>
    rewrite(c, "/api/v1/attestation/verify")
  );
  // The path docs/attestation/v0.1.md documents.
  app.post("/api/v1/attestations/verify", c =>
    rewrite(c, "/api/v1/attestation/verify")
  );

  app.post("/api/v1/attestation", async c => {
    const auth = await authorizeIssuerRequest(
      c.req.header("authorization"),
      c.env as IssuerEnv,
    );
    if (!auth.ok) {
      return c.json({ error: auth.error }, 401, NO_STORE);
    }
    try {
      const body = await c.req.json();
      const attestation = validateAttestation(body);
      const { privateKey, kid } = await loadPrivateKey(c.env);
      const jws = await signAttestation(attestation, privateKey, kid);
      return c.json(
        {
          contract: "AuthiChain Attestation Contract",
          version: "0.1",
          attestation,
          jws,
          kid,
        },
        200,
        NO_STORE
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid attestation";
      const status = message.includes("unavailable") ? 503 : 400;
      return c.json({ error: message }, status, NO_STORE);
    }
  });

  app.put("/api/v1/attestation", async c => {
    const body = await c.req.json().catch(() => ({}));
    if (!hasJws(body)) {
      return c.json({ valid: false, error: "jws is required" }, 400, NO_STORE);
    }
    let publicJwk: Record<string, unknown>;
    try {
      ({ publicJwk } = await loadPrivateKey(c.env));
    } catch (error) {
      return c.json(
        {
          valid: false,
          error: error instanceof Error ? error.message : "key unavailable",
        },
        503,
        NO_STORE
      );
    }
    const { status, payload } = await verifyResponse(body, publicJwk);
    return c.json(payload, status, NO_STORE);
  });

  app.post("/api/v1/attestation/verify", async c => {
    const body = await c.req.json().catch(() => ({}));
    if (!hasJws(body)) {
      return c.json({ valid: false, error: "jws is required" }, 400, NO_STORE);
    }
    const resolved = await resolveAttestationKey(c.env);
    if (!resolved.ok) {
      return c.json({ valid: false, error: resolved.error }, 503, NO_STORE);
    }
    const { status, payload } = await verifyResponse(
      body,
      resolved.key.publicJwk
    );
    return c.json(payload, status, NO_STORE);
  });
}
