// SPDX-License-Identifier: Apache-2.0
// Type declarations for passport.mjs.
import type { KeyObject } from 'node:crypto';

export type PassportVerdict = 'verified' | 'valid-unanchored' | 'invalid';

export interface PassportScan {
  genuine: boolean;
  digitalIdentity: string | null;
  verdict: PassportVerdict;
  reasons: string[];
}

export interface PassportVerifyOptions {
  allowTestnet?: boolean;
  now?: string | number | Date;
}

export interface ReferenceVerifyResult {
  verdict: PassportVerdict;
  reasons: string[];
  checks: Record<string, unknown>;
}

export function assertDigitalIdentity(id: string): string;

export function signPassport(input: {
  digitalIdentity: string;
  privateKey: KeyObject;
  issuer: string;
  validFrom?: string;
  serial?: string;
  gtin?: string | null;
}): Record<string, unknown>;

export function scanProvesGenuine(
  record: unknown,
  anchor?: unknown | null,
  opts?: PassportVerifyOptions,
): PassportScan;

export function verifyScan(
  record: unknown,
  anchor?: unknown | null,
  opts?: PassportVerifyOptions,
): { exitCode: number; body: PassportScan | ReferenceVerifyResult };
