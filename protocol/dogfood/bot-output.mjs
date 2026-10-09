/**
 * DOGFOOD-IDENTITY-V1: signed bot output, reference verifier, append-only ledger.
 *
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Zachary Kietzman (AuthiChain)
 *
 * Zero dependencies (node: builtins only), offline. Reuses the RFC 8785
 * canonicaliser from ../verifier.mjs so there is one JCS implementation.
 *
 * What a valid signature proves: the registered bot key signed these exact
 * bytes at about this time. It does NOT prove the text is true. Research's
 * claims gate and FEDERAL-CLAIMS-RULE still apply to every piece.
 *
 * Every check fails closed: anything unexpected is a failure, and a failure
 * means the piece is blocked.
 */

import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
import { canonicalize } from '../verifier.mjs';

export const PAYLOAD_VERSION = 'aco-bot-sig/1';
export const REGISTRY_VERSION = 'aco-bot-registry/1';
export const LEDGER_VERSION = 'aco-bot-ledger/1';

/** Pinned bot-key JWKS. Root /.well-known/jwks.json serves the attestation key, not bot keys. */
export const PINNED_JWKS_URL = 'https://authichain.com/api/v1/.well-known/bot-jwks.json';
export const FORBIDDEN_JWKS_URLS = new Set([
  'https://authichain.com/.well-known/jwks.json',
  'https://www.authichain.com/.well-known/jwks.json',
]);

export const CHANNELS = new Set(['internal-dryrun', 'x', 'linkedin', 'email']);
export const LEDGER_KINDS = new Set(['dry-run', 'tamper-test', 'live']);

/** Advisor ruling, Oct 9 2026. */
export const MAX_LEDGER_SKEW_MS = 10 * 60 * 1000;
export const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;
export const MAX_CONTENT_BYTES = 100_000;
export const QUALIFY_INITIAL = { count: 20, days: 7 };
export const QUALIFY_RELOCK = { count: 10, days: 3 };

/**
 * Evidence every dry run must carry before it counts toward qualification
 * (ADM-144, MKT-93, RES-154). A signature proves who sent something, not that
 * it is true or lawful, so these are checked separately.
 */
/** Research claims-gate ids look like AE-20261009-RES-154. */
export const CLAIMS_GATE_ID = /^AE-\d{8}-RES-\d+$/;
/** Allowed do-not-contact list locations (box file, or a repo copy). */
export const DNC_LISTS = new Set([
  '/workspace/reports/legal/DO-NOT-CONTACT.md',
  'ops/legal/DO-NOT-CONTACT.md',
]);
/** CAN-SPAM footer postal address (Zac, per MKT-86). Matched with whitespace collapsed. */
export const POSTAL_ADDRESS = '109 N. 4th St., Roscommon, MI 48653';
/** Art. 14 notice link required in email to EU/UK recipients (RES-151 condition 2). */
export const EU_PRIVACY_URL = 'https://authichain.com/privacy#eu-uk';
const OPT_OUT_URL = /https:\/\/[^\s"'<>]*(?:unsubscribe|opt-?out)[^\s"'<>]*/gi;

const BOT_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const ZERO64 = '0'.repeat(64);
const DAY_MS = 24 * 60 * 60 * 1000;

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function toBytes(content) {
  if (typeof content === 'string') return Buffer.from(content, 'utf8');
  if (content instanceof Uint8Array) return Buffer.from(content);
  throw new TypeError('content must be a string or bytes');
}

/** Env/secret name for a bot's private key. Key material lives only in this Worker secret. */
export function botKeySecretName(bot) {
  return 'DOGFOOD_BOT_KEY_' + String(bot).toUpperCase().replace(/-/g, '_');
}

/** Build the canonical payload for exact content bytes. */
export function buildPayload({ bot, channel, kid, content, ts, nonce }) {
  const bytes = toBytes(content);
  return {
    v: PAYLOAD_VERSION,
    bot,
    channel,
    kid,
    content_sha256: sha256Hex(bytes),
    content_bytes: bytes.length,
    ts,
    nonce,
  };
}

/** Bytes that are signed: JCS(payload), UTF-8. */
export function payloadSigningBytes(payload) {
  return Buffer.from(canonicalize(payload), 'utf8');
}

function validatePayloadShape(p, reasons) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    reasons.push('payload_missing');
    return;
  }
  const allowed = new Set(['v', 'bot', 'channel', 'kid', 'content_sha256', 'content_bytes', 'ts', 'nonce']);
  for (const k of Object.keys(p)) if (!allowed.has(k)) reasons.push(`payload_unknown_field:${k}`);
  if (p.v !== PAYLOAD_VERSION) reasons.push('payload_version');
  if (typeof p.bot !== 'string' || !BOT_ID.test(p.bot)) reasons.push('payload_bot');
  if (!CHANNELS.has(p.channel)) reasons.push('payload_channel');
  if (typeof p.kid !== 'string' || !p.kid) reasons.push('payload_kid');
  if (typeof p.content_sha256 !== 'string' || !HEX64.test(p.content_sha256)) reasons.push('payload_content_sha256');
  if (!Number.isInteger(p.content_bytes) || p.content_bytes < 0 || p.content_bytes > MAX_CONTENT_BYTES) {
    reasons.push('payload_content_bytes');
  }
  if (typeof p.ts !== 'string' || Number.isNaN(Date.parse(p.ts))) reasons.push('payload_ts');
  if (typeof p.nonce !== 'string' || !/^[0-9a-f]{16,64}$/.test(p.nonce)) reasons.push('payload_nonce');
}

/** Validate registry structure and the JWKS pin. Returns reasons[] (empty = ok). */
export function validateRegistry(registry) {
  const reasons = [];
  if (!registry || registry.v !== REGISTRY_VERSION) reasons.push('registry_version');
  if (registry?.jwks_url !== PINNED_JWKS_URL) reasons.push('registry_jwks_url_not_pinned');
  if (FORBIDDEN_JWKS_URLS.has(registry?.jwks_url)) reasons.push('registry_jwks_url_forbidden');
  if (!Array.isArray(registry?.bots)) {
    reasons.push('registry_bots');
    return reasons;
  }
  const seenBots = new Set();
  const seenKids = new Set();
  for (const b of registry.bots) {
    if (!BOT_ID.test(b?.bot ?? '')) reasons.push('registry_bot_id');
    if (seenBots.has(b.bot)) reasons.push(`registry_duplicate_bot:${b.bot}`);
    seenBots.add(b.bot);
    if (!['pending', 'active', 'revoked'].includes(b.status)) reasons.push(`registry_status:${b.bot}`);
    if (b.secret_name !== botKeySecretName(b.bot)) reasons.push(`registry_secret_name:${b.bot}`);
    if (!Array.isArray(b.channels) || !b.channels.every((c) => CHANNELS.has(c))) {
      reasons.push(`registry_channels:${b.bot}`);
    }
    if (b.status === 'pending') {
      if (b.kid !== null || b.publicJwk !== null) reasons.push(`registry_pending_has_key:${b.bot}`);
      continue;
    }
    const jwk = b.publicJwk;
    if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string' || !B64URL.test(jwk.x)) {
      reasons.push(`registry_public_jwk:${b.bot}`);
    }
    if (typeof b.kid !== 'string' || !b.kid || jwk?.kid !== b.kid) reasons.push(`registry_kid:${b.bot}`);
    if (seenKids.has(b.kid)) reasons.push(`registry_duplicate_kid:${b.kid}`);
    seenKids.add(b.kid);
    if (jwk && 'd' in jwk) reasons.push(`registry_private_material:${b.bot}`);
    if (b.status === 'revoked' && !b.revoked_at) reasons.push(`registry_revoked_at:${b.bot}`);
  }
  return reasons;
}

/** RFC 7638 thumbprint of an Ed25519 OKP JWK (the kid we register). */
export function jwkThumbprint(jwk) {
  const json = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}"}`;
  return createHash('sha256').update(json).digest('base64url');
}

/**
 * Verify one signed piece against the exact content bytes.
 *
 * opts.now         evaluate time checks at this instant (default: now)
 * opts.ledgerTs    ISO time of the ledger line for this piece; |ts - ledgerTs| <= 10 min
 * opts.requireLedgerTs  fail if ledgerTs is missing (send gate sets this)
 *
 * Returns { ok, reasons[], checks{} }. ok=false means BLOCKED.
 */
export function verifyBotOutput(content, envelope, registry, opts = {}) {
  const reasons = [];
  const checks = {};
  try {
    const regReasons = validateRegistry(registry);
    if (regReasons.length) {
      reasons.push(...regReasons);
      return { ok: false, reasons, checks };
    }
    if (!envelope || envelope.alg !== 'EdDSA' || typeof envelope.sig !== 'string' || !B64URL.test(envelope.sig)) {
      reasons.push('envelope_malformed');
      return { ok: false, reasons, checks };
    }
    const p = envelope.payload;
    validatePayloadShape(p, reasons);
    if (reasons.length) return { ok: false, reasons, checks };

    // Key: registered, active, same bot, channel allowed.
    const entry = registry.bots.find((b) => b.kid === p.kid);
    if (!entry) {
      reasons.push('kid_not_registered');
      return { ok: false, reasons, checks };
    }
    if (entry.status !== 'active') reasons.push(`key_${entry.status}`);
    if (entry.bot !== p.bot) reasons.push('kid_bot_mismatch');
    if (!entry.channels.includes(p.channel)) reasons.push('channel_not_allowed');

    // Signature over exact payload bytes.
    const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: entry.publicJwk.x }, format: 'jwk' });
    const sig = Buffer.from(envelope.sig, 'base64url');
    checks.signature = sig.length === 64 && edVerify(null, payloadSigningBytes(p), key, sig);
    if (!checks.signature) reasons.push('signature_invalid');

    // Content: byte-for-byte.
    const bytes = toBytes(content);
    checks.contentHash = sha256Hex(bytes) === p.content_sha256 && bytes.length === p.content_bytes;
    if (!checks.contentHash) reasons.push('content_hash_mismatch');

    // Time.
    const now = opts.now ? new Date(opts.now).getTime() : Date.now();
    const ts = Date.parse(p.ts);
    if (ts - now > MAX_FUTURE_SKEW_MS) reasons.push('ts_in_future');
    if (opts.ledgerTs !== undefined || opts.requireLedgerTs) {
      const lt = Date.parse(opts.ledgerTs ?? '');
      checks.ledgerSkew = !Number.isNaN(lt) && Math.abs(lt - ts) <= MAX_LEDGER_SKEW_MS;
      if (!checks.ledgerSkew) reasons.push('ts_ledger_skew');
    }
    if (entry.status === 'revoked' && entry.revoked_at && ts >= Date.parse(entry.revoked_at)) {
      reasons.push('signed_after_revocation');
    }
  } catch (err) {
    reasons.push(`verifier_error:${err?.message ?? 'unknown'}`);
  }
  return { ok: reasons.length === 0, reasons, checks };
}

/** After posting: the bytes live on the platform must hash to the signed hash. */
export function checkLiveBytes(liveContent, envelope) {
  try {
    const bytes = toBytes(liveContent);
    const ok = sha256Hex(bytes) === envelope?.payload?.content_sha256;
    return { ok, reasons: ok ? [] : ['live_bytes_mismatch'] };
  } catch (err) {
    return { ok: false, reasons: [`live_bytes_error:${err?.message ?? 'unknown'}`] };
  }
}

// ── Ledger ──────────────────────────────────────────────────────────────────
// ops/dogfood/ledger.jsonl: one JSON object per line, hash-chained. Line n
// carries prev = sha256(exact text of line n-1), or 64 zeros for line 1.

export function parseLedger(text) {
  const lines = text.split('\n').filter((l) => l.length > 0);
  return lines.map((raw) => ({ raw, entry: JSON.parse(raw) }));
}

export function makeLedgerLine(prevRaw, seq, fields) {
  const entry = {
    v: LEDGER_VERSION,
    seq,
    prev: prevRaw ? sha256Hex(Buffer.from(prevRaw, 'utf8')) : ZERO64,
    ...fields,
  };
  return canonicalize(entry);
}

const LEDGER_FIELDS = [
  'v', 'seq', 'prev', 'ts', 'bot', 'channel', 'kind', 'kid', 'content_sha256',
  'envelope_sha256', 'verdict', 'reasons', 'verifier_sha256', 'ref',
  'claims_gate', 'email_checks',
];

/** Check chain integrity and field shape. Returns reasons[] (empty = ok). */
export function checkLedger(text) {
  const reasons = [];
  let rows;
  try {
    rows = parseLedger(text);
  } catch {
    return ['ledger_not_jsonl'];
  }
  let prevRaw = null;
  rows.forEach(({ raw, entry }, i) => {
    const at = `line${i + 1}`;
    if (raw !== canonicalize(entry)) reasons.push(`${at}:not_canonical`);
    for (const k of Object.keys(entry)) if (!LEDGER_FIELDS.includes(k)) reasons.push(`${at}:unknown_field:${k}`);
    if (entry.v !== LEDGER_VERSION) reasons.push(`${at}:version`);
    if (entry.seq !== i + 1) reasons.push(`${at}:seq`);
    const expectPrev = prevRaw ? sha256Hex(Buffer.from(prevRaw, 'utf8')) : ZERO64;
    if (entry.prev !== expectPrev) reasons.push(`${at}:chain_broken`);
    if (!LEDGER_KINDS.has(entry.kind)) reasons.push(`${at}:kind`);
    if (!['pass', 'fail'].includes(entry.verdict)) reasons.push(`${at}:verdict`);
    if (Number.isNaN(Date.parse(entry.ts))) reasons.push(`${at}:ts`);
    if (!CHANNELS.has(entry.channel)) reasons.push(`${at}:channel`);
    if (!HEX64.test(entry.content_sha256 ?? '')) reasons.push(`${at}:content_sha256`);
    prevRaw = raw;
  });
  return reasons;
}

/** Append-only: every line of the base ledger must still be there, unchanged, in order. */
export function checkAppendOnly(baseText, headText) {
  const base = baseText.split('\n').filter((l) => l.length > 0);
  const head = headText.split('\n').filter((l) => l.length > 0);
  if (head.length < base.length) return ['ledger_truncated'];
  for (let i = 0; i < base.length; i++) {
    if (base[i] !== head[i]) return [`ledger_rewritten:line${i + 1}`];
  }
  return [];
}

/**
 * Evidence check for ONE passing dry run. Returns reasons[] (empty = it counts).
 *
 * (a) Every channel: entry.claims_gate = { id: 'AE-YYYYMMDD-RES-N', verdict: 'PASS',
 *     content_sha256 } citing THIS piece's exact content hash. A PASS on any other
 *     hash does not count.
 * (b) Email only: entry.email_checks = {
 *       dnc: { list: <DNC_LISTS path>, list_sha256: hex64, recipient_sha256: hex64, listed: false },
 *       opt_out: { url, http_status: 2xx },   // url must appear in the email bytes
 *       eu_recipient: boolean,
 *     }
 *     and the email bytes must contain POSTAL_ADDRESS, and EU_PRIVACY_URL when
 *     eu_recipient is true.
 * The piece bytes themselves (pieceBytes) must hash to entry.content_sha256, so a
 * tampered stored copy fails. Missing bytes fail.
 */
export function checkDryRunEvidence(entry, pieceBytes) {
  const reasons = [];
  const sha = entry?.content_sha256;

  // Exact bytes of the logged piece.
  let text = null;
  if (pieceBytes === undefined || pieceBytes === null) {
    reasons.push('piece_missing');
  } else {
    try {
      const bytes = toBytes(pieceBytes);
      if (sha256Hex(bytes) !== sha) reasons.push('piece_hash_mismatch');
      else text = bytes.toString('utf8');
    } catch {
      reasons.push('piece_unreadable');
    }
  }

  // (a) Research claims-gate PASS on this exact hash.
  const g = entry?.claims_gate;
  if (!g || typeof g !== 'object' || Array.isArray(g)) {
    reasons.push('claims_gate_missing');
  } else {
    if (typeof g.id !== 'string' || !CLAIMS_GATE_ID.test(g.id)) reasons.push('claims_gate_id');
    if (g.verdict !== 'PASS') reasons.push('claims_gate_not_pass');
    if (typeof g.content_sha256 !== 'string' || !HEX64.test(g.content_sha256)) reasons.push('claims_gate_sha256');
    else if (g.content_sha256 !== sha) reasons.push('claims_gate_hash_mismatch');
    for (const k of Object.keys(g)) if (!['id', 'verdict', 'content_sha256'].includes(k)) reasons.push(`claims_gate_unknown_field:${k}`);
  }

  // (b) Email musts (CAN-SPAM + GDPR Art. 14).
  if (entry?.channel === 'email') {
    const e = entry.email_checks;
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      reasons.push('email_checks_missing');
    } else {
      const d = e.dnc;
      if (!d || typeof d !== 'object') reasons.push('dnc_check_missing');
      else {
        if (!DNC_LISTS.has(d.list)) reasons.push('dnc_list_path');
        if (typeof d.list_sha256 !== 'string' || !HEX64.test(d.list_sha256)) reasons.push('dnc_list_sha256');
        if (typeof d.recipient_sha256 !== 'string' || !HEX64.test(d.recipient_sha256)) reasons.push('dnc_recipient_sha256');
        if (d.listed !== false) reasons.push('dnc_listed_or_unknown');
      }
      if (typeof e.eu_recipient !== 'boolean') reasons.push('eu_recipient_unknown');
      const o = e.opt_out;
      if (!o || typeof o !== 'object' || typeof o.url !== 'string' || !/^https:\/\//.test(o.url)) {
        reasons.push('opt_out_missing');
      } else if (!Number.isInteger(o.http_status) || o.http_status < 200 || o.http_status > 299) {
        reasons.push('opt_out_not_working');
      }
      if (text !== null) {
        const flat = text.replace(/\s+/g, ' ');
        if (!flat.includes(POSTAL_ADDRESS)) reasons.push('postal_address_missing');
        const links = text.match(OPT_OUT_URL) ?? [];
        if (links.length === 0) reasons.push('opt_out_link_missing');
        else if (o && typeof o.url === 'string' && !links.includes(o.url)) reasons.push('opt_out_link_not_checked');
        if (e.eu_recipient === true && !text.includes(EU_PRIVACY_URL)) reasons.push('eu_privacy_link_missing');
      }
    }
  }
  return reasons;
}

/**
 * Qualification status for one bot on one channel (Advisor ruling, Oct 9).
 * This only says whether a bot is ELIGIBLE for the Auditor's 5-random
 * re-verify; unlock itself is PM's written call, never this function.
 *
 * Rules: count trailing consecutive passing dry-runs (any failed dry-run or
 * live line resets the streak). Initial: >=20 spanning >=7 days. After a live
 * failure (relock): >=10 spanning >=3 days. A tamper-test line with verdict
 * 'fail' must exist after the streak started; a tamper-test that PASSED means
 * the verifier is broken and blocks everything.
 *
 * A dry run whose verdict is 'pass' but which fails checkDryRunEvidence (no
 * claims-gate PASS on its exact hash, tampered/missing piece bytes, or for
 * email a missing DNC check, postal address, working opt-out, or EU privacy
 * link) is treated as a FAILED dry run: it does not count and resets the streak.
 *
 * readPiece(entry) returns the exact stored bytes for that ledger entry (or
 * undefined). Without it every dry run fails evidence, i.e. fail closed.
 */
export function qualify(ledgerText, bot, channel, opts = {}) {
  const readPiece = typeof opts.readPiece === 'function' ? opts.readPiece : () => undefined;
  const rows = parseLedger(ledgerText).map((r) => r.entry).filter((e) => e.bot === bot && e.channel === channel);
  const relocked = rows.some((e) => e.kind === 'live' && e.verdict === 'fail');
  const rule = relocked ? QUALIFY_RELOCK : QUALIFY_INITIAL;
  const reasons = [];
  const rejected = [];

  if (rows.some((e) => e.kind === 'tamper-test' && e.verdict === 'pass')) reasons.push('tamper_copy_passed');

  let streak = [];
  for (const e of rows) {
    if ((e.kind === 'dry-run' || e.kind === 'live') && e.verdict === 'fail') streak = [];
    else if (e.kind === 'dry-run' && e.verdict === 'pass') {
      let bytes;
      try {
        bytes = readPiece(e);
      } catch {
        bytes = undefined;
      }
      const why = checkDryRunEvidence(e, bytes);
      if (why.length) {
        rejected.push({ seq: e.seq, reasons: why });
        streak = [];
      } else streak.push(e);
    }
  }
  const spanDays = streak.length > 1
    ? (Date.parse(streak[streak.length - 1].ts) - Date.parse(streak[0].ts)) / DAY_MS
    : 0;
  if (streak.length < rule.count) reasons.push(`streak_${streak.length}_of_${rule.count}`);
  if (spanDays < rule.days) reasons.push(`span_${spanDays.toFixed(2)}d_of_${rule.days}d`);

  const streakStartSeq = streak[0]?.seq ?? Infinity;
  const tamperOk = rows.some((e) => e.kind === 'tamper-test' && e.verdict === 'fail' && e.seq >= streakStartSeq);
  if (!tamperOk) reasons.push('tamper_test_missing');

  return {
    bot,
    channel,
    mode: relocked ? 'requalify' : 'initial',
    streak: streak.length,
    span_days: Number(spanDays.toFixed(2)),
    eligible_for_auditor: reasons.length === 0,
    unlocked: false, // only PM, in writing
    reasons,
    rejected_dry_runs: rejected,
  };
}
