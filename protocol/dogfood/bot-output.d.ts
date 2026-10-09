// SPDX-License-Identifier: Apache-2.0
// Types for bot-output.mjs (DOGFOOD-IDENTITY-V1).
export const PAYLOAD_VERSION: string;
export const REGISTRY_VERSION: string;
export const LEDGER_VERSION: string;
export const PINNED_JWKS_URL: string;
export const FORBIDDEN_JWKS_URLS: Set<string>;
export const CHANNELS: Set<string>;
export const LEDGER_KINDS: Set<string>;
export const MAX_LEDGER_SKEW_MS: number;
export const MAX_FUTURE_SKEW_MS: number;
export const MAX_CONTENT_BYTES: number;
export const QUALIFY_INITIAL: { count: number; days: number };
export const QUALIFY_RELOCK: { count: number; days: number };

export interface BotPayload {
  v: string;
  bot: string;
  channel: string;
  kid: string;
  content_sha256: string;
  content_bytes: number;
  ts: string;
  nonce: string;
}
export interface BotEnvelope {
  alg: 'EdDSA';
  payload: BotPayload | Record<string, string | number>;
  sig: string;
}
export interface Result {
  ok: boolean;
  reasons: string[];
  checks?: Record<string, unknown>;
}
export interface VerifyOpts {
  now?: string | number | Date;
  ledgerTs?: string;
  requireLedgerTs?: boolean;
}

export function sha256Hex(bytes: Uint8Array | string): string;
export function botKeySecretName(bot: string): string;
export function buildPayload(i: { bot: string; channel: string; kid: string; content: string | Uint8Array; ts: string; nonce: string }): BotPayload;
export function payloadSigningBytes(payload: unknown): Uint8Array;
export function validateRegistry(registry: unknown): string[];
export function jwkThumbprint(jwk: { kty: string; crv: string; x: string }): string;
export function verifyBotOutput(content: string | Uint8Array, envelope: unknown, registry: unknown, opts?: VerifyOpts): Result;
export function checkLiveBytes(live: string | Uint8Array, envelope: unknown): Result;
export function parseLedger(text: string): Array<{ raw: string; entry: Record<string, unknown> }>;
export function makeLedgerLine(prevRaw: string | null, seq: number, fields: Record<string, unknown>): string;
export function checkLedger(text: string): string[];
export function checkAppendOnly(baseText: string, headText: string): string[];
export function qualify(ledgerText: string, bot: string, channel: string): {
  bot: string;
  channel: string;
  mode: 'initial' | 'requalify';
  streak: number;
  span_days: number;
  eligible_for_auditor: boolean;
  unlocked: false;
  reasons: string[];
};
