import {
  calculateJwkThumbprint,
  CompactSign,
  compactVerify,
  decodeProtectedHeader,
  exportJWK,
  importJWK,
  importPKCS8,
} from "jose";

export type KeyLike = any;

export const AUTHICHAIN_ATTESTATION_V01 = "0.1" as const;
export const AUTHICHAIN_ATTESTATION_TYP = "AC-ATTESTATION+JWS";

async function resolvePrivateKey(key?: KeyLike): Promise<KeyLike> {
  if (key) return key;
  const raw = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
  if (!raw) {
    throw new Error(
      "AuthiChain attestation private key is not configured; set AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64"
    );
  }
  return importPKCS8(Buffer.from(raw, "base64").toString("utf8"), "EdDSA");
}

export async function getKeyId(key?: KeyLike): Promise<string> {
  return calculateJwkThumbprint(await publicJwkFromPrivateKey(key));
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type AttestationDecision = "verified" | "warning" | "blocked";
export type AttestationStatus = "active" | "revoked" | "unknown";

export interface AuthiChainEvidence {
  id: string;
  type: string;
  digest: `sha256:${string}`;
  uri?: string;
}

export interface AuthiChainAttestationV01 {
  version: "0.1";
  attestation_id: string;
  issuer: { id: string; name: string };
  subject: {
    object_id: string;
    product_class?: string;
    gtin?: string;
    serial?: string;
    lot?: string;
  };
  decision: AttestationDecision;
  status: AttestationStatus;
  issued_at: string;
  expires_at?: string;
  evidence: AuthiChainEvidence[];
}

export interface AttestationVerificationOptions {
  expectedObjectId?: string;
  now?: number;
}

const ISO_DATE_TIME = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export function canonicalize(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

export function b64url(value: Uint8Array | string): string {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function fromB64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function canonicalizeGtin(gtin: string): string {
  if (!/^\d{8,14}$/.test(gtin)) {
    throw new Error("GTIN must be 8-14 digits");
  }
  return gtin.padStart(14, "0");
}

export function validateAttestation(input: unknown): AuthiChainAttestationV01 {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("attestation must be an object");
  }
  const value = input as Record<string, unknown>;
  if (value.version !== "0.1") throw new Error("version must be 0.1");
  if (typeof value.attestation_id !== "string" || !value.attestation_id.trim()) throw new Error("attestation_id is required");
  if (!value.issuer || typeof value.issuer !== "object" || Array.isArray(value.issuer)) throw new Error("issuer is required");
  const issuer = value.issuer as Record<string, unknown>;
  if (typeof issuer.id !== "string" || !issuer.id.trim()) throw new Error("issuer.id is required");
  if (typeof issuer.name !== "string" || !issuer.name.trim()) throw new Error("issuer.name is required");
  if (!value.subject || typeof value.subject !== "object" || Array.isArray(value.subject)) throw new Error("subject is required");
  const subject = value.subject as Record<string, unknown>;
  if (typeof subject.object_id !== "string" || !subject.object_id.trim()) throw new Error("subject.object_id is required");
  if (subject.gtin !== undefined && (typeof subject.gtin !== "string" || !/^\d{8,14}$/.test(subject.gtin))) throw new Error("subject.gtin must contain 8-14 digits");
  for (const field of ["product_class", "serial", "lot"] as const) {
    if (subject[field] !== undefined && typeof subject[field] !== "string") throw new Error(`subject.${field} must be a string`);
  }
  if (!["verified", "warning", "blocked"].includes(String(value.decision))) throw new Error("invalid decision");
  if (!["active", "revoked", "unknown"].includes(String(value.status))) throw new Error("invalid status");
  if (!ISO_DATE_TIME(value.issued_at)) throw new Error("issued_at must be an ISO timestamp");
  if (value.expires_at !== undefined && !ISO_DATE_TIME(value.expires_at)) throw new Error("expires_at must be an ISO timestamp");
  if (value.expires_at !== undefined && Date.parse(value.expires_at as string) <= Date.parse(value.issued_at as string)) throw new Error("expires_at must be after issued_at");
  if (!Array.isArray(value.evidence)) throw new Error("evidence must be an array");
  for (const [index, item] of value.evidence.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`evidence[${index}] must be an object`);
    const evidence = item as Record<string, unknown>;
    if (typeof evidence.id !== "string" || !evidence.id.trim()) throw new Error(`evidence[${index}].id is required`);
    if (typeof evidence.type !== "string" || !evidence.type.trim()) throw new Error(`evidence[${index}].type is required`);
    if (typeof evidence.digest !== "string" || !/^sha256:[A-Fa-f0-9]{64}$/.test(evidence.digest)) throw new Error(`evidence[${index}].digest must be sha256:<64 hex chars>`);
    if (evidence.uri !== undefined && typeof evidence.uri !== "string") throw new Error(`evidence[${index}].uri must be a string`);
  }
  return input as AuthiChainAttestationV01;
}

export async function publicJwkFromPrivateKey(key?: KeyLike) {
  const jwk = await exportJWK(await resolvePrivateKey(key));
  const { d: _d, ...publicJwk } = jwk;
  return publicJwk;
}

export async function signAttestation(input: AuthiChainAttestationV01, privateKey: KeyLike, keyId: string): Promise<string> {
  if (input.subject.gtin) input.subject.gtin = canonicalizeGtin(input.subject.gtin);
  const attestation = validateAttestation(input);
  const protectedHeader = { alg: "EdDSA", kid: keyId, typ: AUTHICHAIN_ATTESTATION_TYP };
  const payload = new TextEncoder().encode(canonicalize(attestation as unknown as Json));
  return new CompactSign(payload).setProtectedHeader(protectedHeader).sign(privateKey);
}

export async function inspectAttestationJws(jws: string, publicJwk: Record<string, unknown>, options: AttestationVerificationOptions = {}): Promise<AuthiChainAttestationV01> {
  const header = decodeProtectedHeader(jws);
  if (header.typ !== AUTHICHAIN_ATTESTATION_TYP || header.alg !== "EdDSA") throw new Error("unsupported attestation JWS header");
  if (typeof header.kid !== "string" || !header.kid) throw new Error("attestation JWS kid is required");
  const expectedKid = typeof publicJwk.kid === "string" ? publicJwk.kid : await calculateJwkThumbprint(publicJwk);
  if (header.kid !== expectedKid) throw new Error("attestation JWS kid does not match verification key");
  const key = await importJWK(publicJwk, "EdDSA");
  const { payload } = await compactVerify(jws, key);
  const parsed = validateAttestation(JSON.parse(new TextDecoder().decode(payload)));
  if (options.expectedObjectId !== undefined && parsed.subject.object_id !== options.expectedObjectId) throw new Error("attestation subject object_id does not match expected object");
  return parsed;
}

export interface AttestationEvaluation {
  valid: boolean;
  decision: AttestationDecision;
  status: AttestationStatus | "expired";
  expired: boolean;
  reasons: string[];
}

export function evaluateAttestation(attestation: AuthiChainAttestationV01, now: number = Date.now()): AttestationEvaluation {
  const expired = attestation.expires_at !== undefined && Date.parse(attestation.expires_at) <= now;
  const reasons: string[] = [];
  if (expired) reasons.push("expired");
  if (attestation.status !== "active") reasons.push(`status_${attestation.status}`);
  if (attestation.decision !== "verified") reasons.push(`decision_${attestation.decision}`);
  return { valid: reasons.length === 0, decision: attestation.decision, status: expired ? "expired" : attestation.status, expired, reasons };
}

export async function verifyAttestationJws(jws: string, publicJwk: Record<string, unknown>, options: AttestationVerificationOptions = {}) {
  const parsed = await inspectAttestationJws(jws, publicJwk, options);
  if (parsed.status !== "active") throw new Error(`attestation status is ${parsed.status}`);
  if (parsed.expires_at !== undefined && Date.parse(parsed.expires_at) <= (options.now ?? Date.now())) throw new Error("attestation has expired");
  return parsed;
}

export function parseJws(jws: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = jws.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("invalid compact JWS");
  return {
    protected: JSON.parse(new TextDecoder().decode(fromB64url(encodedHeader))),
    payload: JSON.parse(new TextDecoder().decode(fromB64url(encodedPayload))),
    signature: encodedSignature,
  };
}

export function toW3cVerifiableCredential(attestation: AuthiChainAttestationV01): Record<string, unknown> {
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://w3id.org/security/suites/jws-2020/v1"],
    id: `urn:uuid:${attestation.attestation_id}`,
    type: ["VerifiableCredential", "AuthiChainAttestation"],
    issuer: { id: attestation.issuer.id, name: attestation.issuer.name },
    issuanceDate: attestation.issued_at,
    expirationDate: attestation.expires_at,
    credentialSubject: { id: attestation.subject.object_id, ...attestation.subject },
    credentialStatus: { type: "StatusList2021Entry", statusPurpose: attestation.status },
    metadata: { decision: attestation.decision, evidence: attestation.evidence, version: attestation.version },
  };
}

export type VerificationDecision =
  | "verified"
  | "warning"
  | "blocked"
  | "revoked"
  | "expired"
  | "not_found"
  | "risk"
  | "indeterminate";

export type VerificationDecisionInput = {
  cryptographicValid: boolean;
  issuerTrusted: boolean;
  claimStatus: "active" | "revoked" | "expired" | "superseded" | null;
  signedDecision: "verified" | "warning" | "blocked";
  expired: boolean;
  riskSignals?: readonly string[];
  found: boolean;
};

export type VerificationDecisionResult = { decision: VerificationDecision; valid: boolean; reasons: string[] };

export function resolveVerificationDecision(input: VerificationDecisionInput): VerificationDecisionResult {
  const reasons: string[] = [];
  if (!input.found) return { decision: "not_found", valid: false, reasons: ["identifier_or_attestation_not_found"] };
  if (!input.cryptographicValid) return { decision: "indeterminate", valid: false, reasons: ["cryptographic_verification_failed"] };
  if (!input.issuerTrusted) return { decision: "indeterminate", valid: false, reasons: ["issuer_not_trusted"] };
  if (input.claimStatus === "revoked") return { decision: "revoked", valid: false, reasons: ["durable_status_revoked"] };
  if (input.claimStatus === "superseded") return { decision: "risk", valid: false, reasons: ["durable_status_superseded"] };
  if (input.expired || input.claimStatus === "expired") return { decision: "expired", valid: false, reasons: ["expired"] };
  if (input.riskSignals && input.riskSignals.length > 0) {
    reasons.push(...input.riskSignals.map(signal => `risk_${signal}`));
    return { decision: "risk", valid: false, reasons };
  }
  if (input.claimStatus !== "active") return { decision: "indeterminate", valid: false, reasons: ["durable_status_unavailable"] };
  if (input.signedDecision === "blocked") return { decision: "blocked", valid: false, reasons: ["decision_blocked"] };
  if (input.signedDecision === "warning") return { decision: "warning", valid: false, reasons: ["decision_warning"] };
  return { decision: "verified", valid: true, reasons };
}

export type CanonicalVerificationResponse = {
  valid: boolean;
  decision: string;
  decision_contract?: string;
  status?: string;
  claim_status?: string;
  cryptographic_status?: string;
  issuer_status?: string;
  overall_valid?: boolean;
  reasons?: string[];
  [key: string]: unknown;
};

export async function verifyWithCanonicalWorker(endpoint: string, jws: string, expectedObjectId?: string): Promise<{ httpStatus: number; response: CanonicalVerificationResponse }> {
  const body: Record<string, string> = { jws };
  if (expectedObjectId) body.expected_object_id = expectedObjectId;
  const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const response = await res.json() as CanonicalVerificationResponse;
  return { httpStatus: res.status, response };
}
