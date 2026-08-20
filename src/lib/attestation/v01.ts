import { calculateJwkThumbprint, CompactSign, compactVerify, decodeProtectedHeader, importJWK, importPKCS8, exportJWK } from 'jose';

export const AUTHICHAIN_ATTESTATION_V01 = '0.1' as const;
export const AUTHICHAIN_ATTESTATION_TYP = 'AC-ATTESTATION+JWS';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type AttestationDecision = 'verified' | 'warning' | 'blocked';
export type AttestationStatus = 'active' | 'revoked' | 'unknown';

export interface AuthiChainEvidence {
  id: string;
  type: string;
  digest: `sha256:${string}`;
  uri?: string;
}

export interface AuthiChainAttestationV01 {
  version: '0.1';
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

export function canonicalize(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function b64url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString('base64url');
}

function fromB64url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

export function validateAttestation(input: unknown): AuthiChainAttestationV01 {
  if (!input || typeof input !== 'object') throw new Error('attestation must be an object');
  const value = input as Record<string, unknown>;
  if (value.version !== '0.1') throw new Error('version must be 0.1');
  if (typeof value.attestation_id !== 'string' || !value.attestation_id) throw new Error('attestation_id is required');
  if (!value.issuer || typeof value.issuer !== 'object') throw new Error('issuer is required');
  if (!value.subject || typeof value.subject !== 'object') throw new Error('subject is required');
  if (!['verified', 'warning', 'blocked'].includes(String(value.decision))) throw new Error('invalid decision');
  if (!['active', 'revoked', 'unknown'].includes(String(value.status))) throw new Error('invalid status');
  if (!Array.isArray(value.evidence)) throw new Error('evidence must be an array');
  if (typeof value.issued_at !== 'string' || Number.isNaN(Date.parse(value.issued_at))) throw new Error('issued_at must be an ISO timestamp');
  return input as AuthiChainAttestationV01;
}

async function loadPrivateKey() {
  const raw = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
  if (!raw) throw new Error('AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 is not configured');
  const pem = Buffer.from(raw, 'base64').toString('utf8');
  return importPKCS8(pem, 'EdDSA');
}

export async function publicJwkFromPrivateKey() {
  const key = await loadPrivateKey();
  const jwk = await exportJWK(key);
  const { d: _d, ...publicJwk } = jwk;
  return publicJwk;
}

export async function getKeyId(): Promise<string> {
  if (process.env.AUTHICHAIN_ATTESTATION_KEY_ID) return process.env.AUTHICHAIN_ATTESTATION_KEY_ID;
  return calculateJwkThumbprint(await publicJwkFromPrivateKey());
}

export async function signAttestation(input: AuthiChainAttestationV01): Promise<string> {
  const attestation = validateAttestation(input);
  const key = await loadPrivateKey();
  const protectedHeader = {
    alg: 'EdDSA',
    kid: await getKeyId(),
    typ: AUTHICHAIN_ATTESTATION_TYP,
  };
  const payload = new TextEncoder().encode(canonicalize(attestation as unknown as Json));
  return new CompactSign(payload)
    .setProtectedHeader(protectedHeader)
    .sign(key);
}

export async function verifyAttestationJws(jws: string, publicJwk: Record<string, unknown>) {
  const header = decodeProtectedHeader(jws);
  if (header.typ !== AUTHICHAIN_ATTESTATION_TYP || header.alg !== 'EdDSA') {
    throw new Error('unsupported attestation JWS header');
  }
  const key = await importJWK(publicJwk, 'EdDSA');
  const { payload } = await compactVerify(jws, key);
  const parsed = JSON.parse(new TextDecoder().decode(payload));
  return validateAttestation(parsed);
}

export function parseJws(jws: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = jws.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('invalid compact JWS');
  return {
    protected: JSON.parse(new TextDecoder().decode(fromB64url(encodedHeader))),
    payload: JSON.parse(new TextDecoder().decode(fromB64url(encodedPayload))),
    signature: encodedSignature,
  };
}

export { b64url };
