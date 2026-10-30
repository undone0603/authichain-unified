import type { Hono } from "hono";
import { importPKCS8 } from "jose";
import {
  canonicalize,
  evaluateAttestation,
  inspectAttestationJws,
  publicJwkFromPrivateKey,
  resolveVerificationDecision,
  signAttestation,
  validateAttestation,
} from "../packages/verifier/src/index";
import {
  resolveAttestationKey,
  resolveVerificationKeys,
  selectVerificationKey,
  publicJwkOf,
  type AttestationEnv,
  type VerificationKey,
} from "./jwks";
import { authorizeIssuerRequest, type IssuerEnv } from "./issuer";
import { getCurrentAttestationStatus, getIssuer, publishAttestationRecord, recordStatusEvent, type AttestationRegistryEnv } from "./attestation-registry";
import { emitTrustEvent } from "../shared/trust-events";
import { getCurrentAttestationStatus, getIssuer, recordStatusEvent, type AttestationRegistryEnv } from "./attestation-registry";
export type AttestationRegistry = {
  getCurrentStatus: (env: AttestationRegistryEnv, attestationId: string) => ReturnType<typeof getCurrentAttestationStatus>;
  getIssuer: (env: AttestationRegistryEnv, issuerId: string) => ReturnType<typeof getIssuer>;
  recordStatusEvent: typeof recordStatusEvent;
  publishRecord?: typeof publishAttestationRecord;
};

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

const DECISION_CONTRACT = "AuthiChain Verification Decision v1";

/** Fail-closed verify envelope so crypto/transport failures stay in the decision vocabulary. */
function failClosedVerifyPayload(
  error: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    valid: false,
    decision: "indeterminate",
    decision_contract: DECISION_CONTRACT,
    overall_valid: false,
    cryptographic_status:
      typeof extras.cryptographic_status === "string"
        ? extras.cryptographic_status
        : "invalid",
    error,
    ...extras,
  };
}

/**
 * Check a JWS against the key its header names, from the current and retired
 * verification keys. Unknown kid, bad signature or schema are all 400.
 */
async function inspectWithKeys(
  jws: string,
  keys: VerificationKey[],
  options: { expectedObjectId?: string } = {},
): Promise<
  | { ok: true; attestation: Awaited<ReturnType<typeof inspectAttestationJws>>; key: VerificationKey }
  | { ok: false; error: string }
> {
  const selected = selectVerificationKey(jws, keys);
  if (!selected.ok) return selected;
  try {
    const attestation = await inspectAttestationJws(
      jws,
      publicJwkOf(selected.key) as Record<string, unknown>,
      options,
    );
    return { ok: true, attestation, key: selected.key };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid signature" };
  }
}

async function verifyResponse(
  body: unknown,
  keys: VerificationKey[],
  env: AttestationRegistryEnv,
  registry: AttestationRegistry,
): Promise<{ status: 200 | 400 | 404 | 409 | 503; payload: Record<string, unknown> }> {
  const input = (body ?? {}) as Record<string, unknown>;
  const jws = input.jws;
  if (typeof jws !== "string" || !jws.trim()) {
    return {
      status: 400,
      payload: failClosedVerifyPayload("jws is required", {
        cryptographic_status: "unknown",
      }),
    };
  }
  const expected = input.expected_object_id ?? input.expectedObjectId;
  const inspected = await inspectWithKeys(jws.trim(), keys, {
    expectedObjectId: typeof expected === "string" ? expected : undefined,
  });
  if (!inspected.ok) {
    return {
      status: 400,
      payload: failClosedVerifyPayload(inspected.error, {
        cryptographic_status: "invalid",
      }),
    };
  }
  const { attestation, key: verificationKey } = inspected;
  const evaluation = evaluateAttestation(attestation);
  const issuer = await registry.getIssuer(env, attestation.issuer.id);
  if (!issuer.ok) {
    return {
      status: issuer.status,
      payload: failClosedVerifyPayload(issuer.error, {
        signature: "valid",
        cryptographic_status: "valid",
      }),
    };
  }
  const now = Date.now();
  const issuerActive =
    issuer.issuer.status === "trusted" &&
    Date.parse(issuer.issuer.validFrom) <= now &&
    (!issuer.issuer.validUntil || Date.parse(issuer.issuer.validUntil) > now);
  const durable = await registry.getCurrentStatus(env, attestation.attestation_id);
  if (!durable.ok) {
    return {
      status: durable.status as 503,
      payload: failClosedVerifyPayload(durable.error, {
        signature: "valid",
        cryptographic_status: "valid",
      }),
    };
  }
  const durableStatus = durable.status?.claimStatus ?? null;
  const riskSignals = Array.isArray(input.risk_signals)
    ? input.risk_signals.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : Array.isArray(input.riskSignals)
      ? input.riskSignals.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];
  const claimStatusForDecision =
    (durableStatus ??
      (evaluation.status === "expired"
        ? "expired"
        : evaluation.status === "revoked"
          ? "revoked"
          : evaluation.status === "active"
            ? "active"
            : null)) as "active" | "revoked" | "expired" | "superseded" | null;
  const decisionResult = resolveVerificationDecision({
    cryptographicValid: true,
    issuerTrusted: issuerActive,
    claimStatus: claimStatusForDecision,
    signedDecision: attestation.decision,
    expired: evaluation.expired,
    found: true,
    ...(riskSignals.length ? { riskSignals } : {}),
  });
  const effectiveStatus = durableStatus ?? evaluation.status;
  const authorized =
    decisionResult.valid === true && decisionResult.decision === "verified";
  return {
    status: decisionResult.valid ? 200 : 409,
    payload: {
      valid: decisionResult.valid,
      contract: "AuthiChain Attestation Contract",
      version: "0.1",
      decision: decisionResult.decision,
      decision_contract: "AuthiChain Verification Decision v1",
      status: effectiveStatus,
      claim_status: effectiveStatus,
      cryptographic_status: "valid",
      issuer_status: issuer.issuer.status,
      overall_valid: decisionResult.valid,
      ...(durable.status ? {
        status_event_id: durable.status.eventId,
        effective_at: durable.status.effectiveAt,
        ...(durable.status.reasonCode ? { reason_code: durable.status.reasonCode } : {}),
      } : {}),
      expired: evaluation.expired,
      reasons: decisionResult.reasons,
      signature: "valid",
      attestation,
      // Structured decision surfaces for DPP / QRON / AgentZ consumers.
      // Cryptographically valid ≠ authorized; not_found ≠ counterfeit.
      trust: {
        evidence: {
          cryptographic_status: "valid",
          signature: "valid",
          issuer_id: attestation.issuer.id,
          issuer_status: issuer.issuer.status,
          kid: verificationKey.kid,
          key_status: verificationKey.key_status,
          subject_object_id: attestation.subject.object_id,
          evidence_count: Array.isArray(attestation.evidence)
            ? attestation.evidence.length
            : 0,
        },
        lifecycle: {
          claim_status: effectiveStatus,
          expired: evaluation.expired,
          durable: Boolean(durable.status),
        },
        risk: {
          signals: riskSignals,
          flagged: riskSignals.length > 0 || decisionResult.decision === "risk",
        },
        policy: {
          authorized,
          rules_evaluated: [
            "cryptographic_validity",
            "issuer_trust",
            "durable_lifecycle",
            "expiry",
            "risk_signals",
            "signed_decision",
          ],
        },
        decision: {
          code: decisionResult.decision,
          valid: decisionResult.valid,
          reasons: decisionResult.reasons,
        },
      },
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
    "POST /attestations/:id/revoke": "durably revoke an attestation",
    "POST /attestations/:id/supersede": "durably supersede an attestation with a replacement JWS",
  },
  jwks: "/.well-known/jwks.json",
  canonical: "/api/v1/attestation",
};

export function registerAttestationApi<
  E extends AttestationEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>, registry: AttestationRegistry = {
  getCurrentStatus: getCurrentAttestationStatus,
  getIssuer,
  recordStatusEvent,
  publishRecord: publishAttestationRecord,
}): void {
  const rewrite = (
    c: { req: { url: string; raw: Request }; env: E },
    path: string
  ) => {
    const url = new URL(c.req.url);
    url.pathname = path;
    return app.fetch(new Request(url.toString(), c.req.raw), c.env);
  };

  const verifyWithKeySet = async (env: E, body: unknown): Promise<Response> => {
    const keys = await resolveVerificationKeys(env);
    if (!keys.ok) {
      emitTrustEvent("attestation.rejected", {
        route: "/api/v1/attestation/verify",
        decision: "indeterminate",
        valid: false,
        reasons: ["verification_key_unavailable"],
        http_status: 503,
      });
      return Response.json(
        failClosedVerifyPayload(keys.error, { cryptographic_status: "unknown" }),
        { status: 503, headers: NO_STORE },
      );
    }
    const { status, payload } = await verifyResponse(
      body,
      keys.keys,
      env as AttestationRegistryEnv,
      registry,
    );
    const attestation = payload.attestation as
      | { attestation_id?: string; issuer?: { id?: string }; subject?: { object_id?: string } }
      | undefined;
    const evidence = (payload.trust as { evidence?: { kid?: string; key_status?: string } } | undefined)?.evidence;
    emitTrustEvent(payload.valid === true ? "attestation.verified" : "attestation.rejected", {
      route: "/api/v1/attestation/verify",
      attestation_id: attestation?.attestation_id,
      issuer_id: attestation?.issuer?.id,
      subject_object_id: attestation?.subject?.object_id,
      kid: evidence?.kid,
      key_status: evidence?.key_status,
      decision: typeof payload.decision === "string" ? payload.decision : undefined,
      valid: payload.valid === true,
      reasons: Array.isArray(payload.reasons) ? (payload.reasons as string[]) : undefined,
      http_status: status,
    });
    return Response.json(payload, { status, headers: NO_STORE });
  };

  app.get("/api/v1/attestation", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));
  app.get("/api/attest", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));
  app.get("/api/attestations", c => c.json(ATTESTATION_INDEX, 200, NO_STORE));

  app.get("/api/v1/attestations/:id/status", async c => {
    const attestationId = decodeURIComponent(c.req.param("id"));
    const result = await registry.getCurrentStatus(c.env as AttestationRegistryEnv, attestationId);
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
    const idempotencyKey = c.req.header("Idempotency-Key")?.trim().slice(0, 200) ||
      (typeof body.idempotency_key === "string" ? body.idempotency_key.trim().slice(0, 200) : undefined);

    const keys = await resolveVerificationKeys(c.env);
    if (!keys.ok) return c.json({ error: keys.error }, 503, NO_STORE);
    const inspected = await inspectWithKeys(body.jws.trim(), keys.keys);
    if (!inspected.ok) return c.json({ error: inspected.error }, 400, NO_STORE);
    const { attestation } = inspected;

    const attestationId = decodeURIComponent(c.req.param("id"));
    if (attestation.attestation_id !== attestationId) {
      return c.json({ error: "attestation id does not match jws" }, 400, NO_STORE);
    }

    const issuerId = attestation.issuer.id;
    const issuer = await registry.getIssuer(c.env as AttestationRegistryEnv, issuerId);
    if (!issuer.ok) return c.json({ error: issuer.error }, issuer.status, NO_STORE);
    const issuerNow = Date.now();
    const issuerActive =
      issuer.issuer.status === "trusted" &&
      Date.parse(issuer.issuer.validFrom) <= issuerNow &&
      (!issuer.issuer.validUntil || Date.parse(issuer.issuer.validUntil) > issuerNow);
    if (!issuerActive) {
      return c.json({ error: "issuer is not currently trusted" }, 403, NO_STORE);
    }

    const subjectHash = `sha256:${await sha256Hex(JSON.stringify(attestation.subject))}`;
    const evidenceDigest =
      Array.isArray(attestation.evidence) && typeof attestation.evidence[0]?.digest === "string"
        ? attestation.evidence[0].digest
        : undefined;

    const event = await registry.recordStatusEvent(c.env as AttestationRegistryEnv, {
      eventType: "attestation.revoked",
      attestationId,
      issuerId,
      ...(reasonCode ? { reasonCode } : {}),
      subjectHash,
      ...(evidenceDigest ? { evidenceDigest } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    if (!event.ok) return c.json({ error: event.error }, event.status, NO_STORE);

    emitTrustEvent("attestation.revoked", {
      attestation_id: attestationId,
      issuer_id: issuerId,
      event_id: event.eventId,
      reason_code: reasonCode,
      claim_status: "revoked",
    });
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

  app.post("/api/v1/attestations/:id/supersede", async c => {
    const auth = await authorizeIssuerRequest(c.req.header("authorization"), c.env as IssuerEnv);
    if (!auth.ok) return c.json({ error: auth.error }, 401, NO_STORE);
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.jws !== "string" || !body.jws.trim()) {
      return c.json({ error: "jws is required" }, 400, NO_STORE);
    }
    if (typeof body.replacement_jws !== "string" || !body.replacement_jws.trim()) {
      return c.json({ error: "replacement_jws is required" }, 400, NO_STORE);
    }
    const attestationId = decodeURIComponent(c.req.param("id"));
    const keys = await resolveVerificationKeys(c.env);
    if (!keys.ok) return c.json({ error: keys.error }, 503, NO_STORE);
    const originalInspected = await inspectWithKeys(body.jws.trim(), keys.keys);
    if (!originalInspected.ok) return c.json({ error: originalInspected.error }, 400, NO_STORE);
    const replacementInspected = await inspectWithKeys(body.replacement_jws.trim(), keys.keys);
    if (!replacementInspected.ok) return c.json({ error: replacementInspected.error }, 400, NO_STORE);
    // A replacement must come from the key that signs today: superseding onto
    // a retired key would mint new trust from a key that no longer issues.
    if (replacementInspected.key.key_status !== "current") {
      return c.json({ error: "replacement must be signed by the current key" }, 400, NO_STORE);
    }
    const original = originalInspected.attestation;
    const replacement = replacementInspected.attestation;
    if (original.attestation_id !== attestationId) {
      return c.json({ error: "attestation id does not match jws" }, 400, NO_STORE);
    }
    if (original.issuer.id !== replacement.issuer.id) {
      return c.json({ error: "replacement issuer does not match original issuer" }, 400, NO_STORE);
    }
    if (original.attestation_id === replacement.attestation_id) {
      return c.json({ error: "replacement attestation must differ" }, 400, NO_STORE);
    }
    const issuerId = original.issuer.id;
    const issuer = await registry.getIssuer(c.env as AttestationRegistryEnv, issuerId);
    if (!issuer.ok) return c.json({ error: issuer.error }, issuer.status, NO_STORE);
    const issuerNow = Date.now();
    const issuerActive = issuer.issuer.status === "trusted" &&
      Date.parse(issuer.issuer.validFrom) <= issuerNow &&
      (!issuer.issuer.validUntil || Date.parse(issuer.issuer.validUntil) > issuerNow);
    if (!issuerActive) return c.json({ error: "issuer is not currently trusted" }, 403, NO_STORE);
    const reasonCode = typeof body.reason_code === "string" ? body.reason_code.trim().slice(0, 120) : undefined;
    const idempotencyKey = c.req.header("Idempotency-Key")?.trim().slice(0, 200) ||
      (typeof body.idempotency_key === "string" ? body.idempotency_key.trim().slice(0, 200) : undefined);
    const subjectHash = `sha256:${await sha256Hex(JSON.stringify(original.subject))}`;
    const evidenceDigest = Array.isArray(original.evidence) && typeof original.evidence[0]?.digest === "string"
      ? original.evidence[0].digest : undefined;
    const event = await registry.recordStatusEvent(c.env as AttestationRegistryEnv, {
      eventType: "attestation.superseded",
      attestationId,
      issuerId,
      ...(reasonCode ? { reasonCode } : {}),
      subjectHash,
      ...(evidenceDigest ? { evidenceDigest } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      supersedesAttestationId: replacement.attestation_id,
    });
    if (!event.ok) return c.json({ error: event.error }, event.status, NO_STORE);
    emitTrustEvent("attestation.superseded", {
      attestation_id: attestationId,
      issuer_id: issuerId,
      event_id: event.eventId,
      reason_code: reasonCode,
      claim_status: "superseded",
    });
    return c.json({
      attestation_id: attestationId,
      claim_status: "superseded",
      supersedes_attestation_id: replacement.attestation_id,
      event_id: event.eventId,
      issuer_id: issuerId,
      reason_code: reasonCode,
    }, 200, NO_STORE);
  });

  app.post("/api/v1/attestations/publish", async c => {
    const auth = await authorizeIssuerRequest(
      c.req.header("authorization"),
      c.env as IssuerEnv,
    );
    if (!auth.ok) {
      return c.json({ error: auth.error }, 401, NO_STORE);
    }

    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const sealId = typeof body.seal_id === "string" ? body.seal_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sealId)) {
      return c.json({ error: "seal_id must be a UUID for an existing registered seal" }, 400, NO_STORE);
    }

    let attestation;
    try {
      attestation = validateAttestation(body.attestation);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "invalid attestation" },
        400,
        NO_STORE,
      );
    }

    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,179}$/.test(attestation.attestation_id) ||
      attestation.issuer.id !== "https://authichain.com" ||
      attestation.issuer.name !== "AuthiChain" ||
      attestation.status !== "active"
    ) {
      return c.json({
        error: "publication requires a bounded attestation_id, the AuthiChain issuer, and active status",
      }, 400, NO_STORE);
    }
    if (!Array.isArray(attestation.evidence) || attestation.evidence.length === 0) {
      return c.json({ error: "at least one evidence item is required for publication" }, 400, NO_STORE);
    }

    const issuerState = await registry.getIssuer(c.env as AttestationRegistryEnv, attestation.issuer.id);
    if (!issuerState.ok) {
      return c.json({ error: issuerState.error }, issuerState.status, NO_STORE);
    }
    const issuerNow = Date.now();
    const issuerValidFrom = Date.parse(issuerState.issuer.validFrom);
    const issuerValidUntil = issuerState.issuer.validUntil
      ? Date.parse(issuerState.issuer.validUntil)
      : null;
    if (
      issuerState.issuer.status !== "trusted" ||
      !Number.isFinite(issuerValidFrom) ||
      issuerValidFrom > issuerNow ||
      (issuerValidUntil !== null &&
        (!Number.isFinite(issuerValidUntil) || issuerValidUntil <= issuerNow))
    ) {
      return c.json({ error: "issuer is not currently trusted for publication" }, 403, NO_STORE);
    }

    let privateKey: Awaited<ReturnType<typeof loadPrivateKey>>["privateKey"];
    let kid: string;
    try {
      const loaded = await loadPrivateKey(c.env);
      privateKey = loaded.privateKey;
      kid = loaded.kid;
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "key unavailable" },
        503,
        NO_STORE,
      );
    }

    try {
      const jws = await signAttestation(attestation, privateKey, kid);
      const recordHash = `sha256:${await sha256Hex(jws)}`;
      const canonicalSubject = canonicalize(
        attestation.subject as unknown as Parameters<typeof canonicalize>[0],
      );
      const subjectHash = `sha256:${await sha256Hex(canonicalSubject)}`;
      const firstEvidence = attestation.evidence[0];
      if (!firstEvidence?.digest) {
        return c.json({ error: "the first evidence item must include a digest" }, 400, NO_STORE);
      }
      const evidenceDigest = firstEvidence.digest;

      if (!registry.publishRecord) {
        return c.json({ error: "signed-record publisher unavailable" }, 503, NO_STORE);
      }
      const published = await registry.publishRecord(c.env as AttestationRegistryEnv, {
        sealId,
        attestation,
        issuerKid: kid,
        jws,
        recordHash,
        subjectHash,
        evidenceDigest,
      });
      if (!published.ok) {
        return c.json({ error: published.error }, published.status, NO_STORE);
      }

      const recordUrl = `https://authichain.com/api/authichain/attestations?assetId=${encodeURIComponent(published.seal.id)}`;
      return c.json({
        contract: "AuthiChain Attestation Contract",
        version: "0.1",
        attestation,
        jws,
        kid,
        record_hash: recordHash,
        record_url: recordUrl,
        seal: {
          id: published.seal.id,
          product_id: published.seal.product_id,
          batch_id: published.seal.batch_id,
          brand: published.seal.brand,
        },
        durable_status_event_id: published.eventId,
        published: true,
        already_published: published.alreadyPublished,
        semantics: "issuer-signed claim; the signature and claim status still require verification, and this is not proof of physical authenticity by itself",
      }, 200, NO_STORE);
    } catch (error) {
      const message = error instanceof Error ? error.message : "publication failed";
      return c.json({ error: message }, 503, NO_STORE);
    }
  });

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
      emitTrustEvent("attestation.created", {
        attestation_id: attestation.attestation_id,
        issuer_id: attestation.issuer.id,
        subject_object_id: attestation.subject.object_id,
        kid,
        decision: attestation.decision,
      });
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
      return c.json(
        failClosedVerifyPayload("jws is required", {
          cryptographic_status: "unknown",
        }),
        400,
        NO_STORE,
      );
    }
    return verifyWithKeySet(c.env, body);
  });

  app.post("/api/v1/attestation/verify", async c => {
    const body = await c.req.json().catch(() => ({}));
    if (!hasJws(body)) {
      return c.json(
        failClosedVerifyPayload("jws is required", {
          cryptographic_status: "unknown",
        }),
        400,
        NO_STORE,
      );
    }
    return verifyWithKeySet(c.env, body);
  });
}
