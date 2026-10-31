// SPDX-License-Identifier: Apache-2.0
// Type declarations for verifier.mjs (AuthiChain Verification Specification v0.1.0).
import type { KeyObject } from 'node:crypto';

export type Verdict = 'verified' | 'valid-unanchored' | 'invalid';

export interface VerifyResult {
  verdict: Verdict;
  reasons: string[];
  checks: Record<string, unknown>;
}

export interface VerifyOptions {
  /** Accept testnet anchors (SPEC §4.1). Default false. */
  allowTestnet?: boolean;
  /** Evaluate validity windows at this time instead of now. */
  now?: string | number | Date;
  /** Also require the record's did:key signer to be a key in this JWKS. */
  jwks?: { keys: unknown[] };
}

export function verifyRecord(record: unknown, anchor?: unknown | null, opts?: VerifyOptions): VerifyResult;
export function canonicalize(value: unknown): string;
export function signingBytes(record: unknown): Buffer;
export function sha256Hex(bytes: Buffer | Uint8Array | string): string;
export function base58Decode(str: string): Buffer;
export function publicKeyFromDidKey(did: string): KeyObject;

export type AttestationVerdict = 'valid-offline' | 'invalid';

export interface AttestationVerifyResult {
  verdict: AttestationVerdict;
  reasons: string[];
  checks: { kid?: boolean; signature?: boolean };
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
}

export const ATTESTATION_TYP: 'AC-ATTESTATION+JWS';
export function verifyAttestationJws(
  jws: string,
  jwks: { keys: unknown[] },
  opts?: { now?: string | number | Date },
): AttestationVerifyResult;
export function base58Encode(bytes: Buffer | Uint8Array): string;
export function didKeyFromJwk(jwk: { kty: string; crv: string; x: string }): string;
