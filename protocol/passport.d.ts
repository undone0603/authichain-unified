// SPDX-License-Identifier: Apache-2.0
// Type declarations for passport.mjs.
import type { KeyObject } from 'node:crypto';

export type PassportVerdict = 'verified' | 'valid-unanchored' | 'invalid';

export interface ProductBinding {
  method: 'seal_serial_sha256' | 'brand_domain_digital_link' | 'none';
  pass: boolean;
  reason: string | null;
  samePassport: true;
}

export interface PassportScan {
  genuine: boolean;
  digitalIdentity: string | null;
  verdict: PassportVerdict;
  reasons: string[];
}

export interface PassportObservation {
  sealSerial?: unknown;
  nfcMatch?: unknown;
  visualMatch?: unknown;
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
  sealSerial?: string;
  subject?: Record<string, unknown> | null;
}): Record<string, unknown>;

export function scanProvesGenuine(
  record: unknown,
  anchor?: unknown | null,
  opts?: PassportVerifyOptions,
): PassportScan;

export function storePassport(
  metadata: unknown,
  passport: unknown,
  anchor?: unknown,
): Record<string, unknown>;

export function productPassportMetadata(input: unknown): Record<string, unknown> | null;

export function digitalIdentityOf(metadata: unknown): string | null;

export function checkSealSerial(record: unknown, presentedSerial?: string | null): ProductBinding;

export function productBindingFor(
  record: unknown,
  observation?: PassportObservation | null,
): ProductBinding;

export function scanPassport(
  record: unknown,
  anchor?: unknown | null,
  observation?: PassportObservation | null,
  opts?: PassportVerifyOptions,
): PassportScan & { productBinding: ProductBinding };

export function productBindingSentence(scan: {
  genuine?: boolean;
  digitalIdentity?: string | null;
  productBinding?: ProductBinding | null;
  anchorTransactionQueried?: boolean;
} | null): string | null;

export function appendPassportEvidence(metadata: unknown, entry: unknown): Record<string, unknown>;

export const UDI_PRESENT_SENTENCE: string;
export const UDI_ABSENT_SENTENCE: string;

export function udiEvidence(
  metadata: unknown,
  input?: { udiDi?: unknown; udiPi?: unknown; category?: unknown } | null,
): {
  stored: boolean;
  entry: { type: 'manufacturer_udi'; udiDi: string; udiPi?: string } | null;
  metadata: unknown;
  message: string;
};

export function verifyScan(
  record: unknown,
  anchor?: unknown | null,
  opts?: PassportVerifyOptions,
): { exitCode: number; body: PassportScan | ReferenceVerifyResult };
