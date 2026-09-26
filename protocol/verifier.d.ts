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
}

export function verifyRecord(record: unknown, anchor?: unknown | null, opts?: VerifyOptions): VerifyResult;
export function canonicalize(value: unknown): string;
export function signingBytes(record: unknown): Buffer;
export function sha256Hex(bytes: Buffer | Uint8Array | string): string;
export function base58Decode(str: string): Buffer;
export function publicKeyFromDidKey(did: string): KeyObject;
