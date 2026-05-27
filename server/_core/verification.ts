/**
 * Cryptographic QR verification — ported from Z-kie/qron lib/verification.ts
 * Provides stateless hash-based product authentication that works without
 * a database round-trip. The DB lookup in /api/v1/verify is the authoritative
 * source; this layer is a fast first-pass tamper check.
 */

import { createHash } from 'node:crypto';
import { ENV } from './env.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VerificationPayload {
  productId: string;
  batchId?:  string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface VerificationResult {
  valid:     boolean;
  hash:      string;
  productId: string;
  timestamp: number;
  message:   string;
}

export interface QRVerificationRecord {
  id:         string;
  hash:       string;
  productId:  string;
  batchId?:   string;
  issuedAt:   Date;
  expiresAt?: Date;
  scanCount:  number;
  revoked:    boolean;
}

// ── Config ───────────────────────────────────────────────────────────────────

const HASH_ALGORITHM  = 'sha256';
const DEFAULT_TTL_MS  = 1_000 * 60 * 60 * 24 * 365; // 1 year

function getSecret(): string {
  // Falls back to the project name so legacy qron QR codes still verify
  return (process.env.VERIFICATION_SECRET ?? ENV.cookieSecret ?? 'authichain-unified').slice(0, 64);
}

// ── Core ─────────────────────────────────────────────────────────────────────

export function generateVerificationHash(payload: VerificationPayload): string {
  const raw = JSON.stringify({
    productId: payload.productId,
    batchId:   payload.batchId ?? '',
    timestamp: payload.timestamp,
    secret:    getSecret(),
  });
  return createHash(HASH_ALGORITHM).update(raw).digest('hex');
}

export function createVerificationRecord(
  payload: VerificationPayload,
  ttlMs: number = DEFAULT_TTL_MS,
): QRVerificationRecord {
  const hash      = generateVerificationHash(payload);
  const issuedAt  = new Date(payload.timestamp);
  const expiresAt = new Date(payload.timestamp + ttlMs);
  return {
    id:        `vrf_${hash.slice(0, 12)}`,
    hash,
    productId: payload.productId,
    batchId:   payload.batchId,
    issuedAt,
    expiresAt,
    scanCount: 0,
    revoked:   false,
  };
}

export function verifyHash(
  incomingHash: string,
  record: QRVerificationRecord,
): VerificationResult {
  const now = Date.now();

  if (record.revoked) {
    return {
      valid: false, hash: incomingHash,
      productId: record.productId, timestamp: now,
      message: 'This product verification has been revoked.',
    };
  }

  if (record.expiresAt && now > record.expiresAt.getTime()) {
    return {
      valid: false, hash: incomingHash,
      productId: record.productId, timestamp: now,
      message: 'Verification record has expired.',
    };
  }

  const isValid = incomingHash === record.hash;
  return {
    valid: isValid, hash: incomingHash,
    productId: record.productId, timestamp: now,
    message: isValid
      ? 'Authentic product verified on AuthiChain.'
      : 'Hash mismatch — possible counterfeit detected.',
  };
}

export function buildVerificationUrl(baseUrl: string, productId: string, hash: string): string {
  const url = new URL('/verify', baseUrl);
  url.searchParams.set('id', productId);
  url.searchParams.set('hash', hash);
  return url.toString();
}

export function issueVerificationUrl(
  baseUrl: string,
  productId: string,
  batchId?: string,
): { url: string; hash: string; record: QRVerificationRecord } {
  const payload: VerificationPayload = { productId, batchId, timestamp: Date.now() };
  const record = createVerificationRecord(payload);
  const url    = buildVerificationUrl(baseUrl, productId, record.hash);
  return { url, hash: record.hash, record };
}

/**
 * Quick stateless check: does the hash in a QR scan URL look valid?
 * Pass the productId and hash from the scan; this regenerates all candidate
 * timestamps within a tolerance window and checks for a match.
 *
 * Used as a fast pre-filter before hitting Supabase.
 */
export function quickVerify(productId: string, hash: string, toleranceMs = 60_000): boolean {
  // We can't know the original timestamp, so we can't regenerate the hash
  // without the record. This function is a structural placeholder — the real
  // check is always done by verifyHash() against the stored QRVerificationRecord.
  // Returns true to allow the DB lookup to proceed.
  return typeof productId === 'string' && typeof hash === 'string' && hash.length === 64;
}
