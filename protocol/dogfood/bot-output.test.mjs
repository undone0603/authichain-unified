// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as edSign, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildPayload, payloadSigningBytes, verifyBotOutput, validateRegistry, checkLiveBytes,
  makeLedgerLine, checkLedger, checkAppendOnly, qualify, jwkThumbprint, botKeySecretName,
  PINNED_JWKS_URL,
} from './bot-output.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = '2026-10-09T16:00:00.000Z';
const TEXT = 'AuthiChain dry run #1. No claims here, just bytes.\n';

function makeBot(bot = 'grok-bot', overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ format: 'jwk' });
  const kid = jwkThumbprint(pub);
  const entry = {
    bot,
    channels: ['internal-dryrun', 'x'],
    status: 'active',
    kid,
    publicJwk: { kty: 'OKP', crv: 'Ed25519', x: pub.x, kid },
    secret_name: botKeySecretName(bot),
    added: '2026-10-09',
    revoked_at: null,
    ...overrides,
  };
  return { entry, privateKey };
}

function registryOf(...entries) {
  return { v: 'aco-bot-registry/1', jwks_url: PINNED_JWKS_URL, bots: entries };
}

function signed(privateKey, entry, content = TEXT, over = {}) {
  const payload = { ...buildPayload({
    bot: entry.bot, channel: 'x', kid: entry.kid, content, ts: NOW, nonce: 'a1b2c3d4e5f60718',
  }), ...over };
  const sig = edSign(null, payloadSigningBytes(payload), privateKey).toString('base64url');
  return { alg: 'EdDSA', payload, sig };
}

describe('verifyBotOutput', () => {
  const { entry, privateKey } = makeBot();
  const reg = registryOf(entry);

  it('passes a valid signature over the exact bytes', () => {
    const r = verifyBotOutput(TEXT, signed(privateKey, entry), reg, { now: NOW, ledgerTs: NOW });
    expect(r).toMatchObject({ ok: true, reasons: [] });
  });

  it('BLOCKS a tampered copy (one byte changed)', () => {
    const env = signed(privateKey, entry);
    const r = verifyBotOutput(TEXT.replace('#1', '#2'), env, reg, { now: NOW });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('content_hash_mismatch');
  });

  it('BLOCKS a payload edited after signing', () => {
    const env = signed(privateKey, entry);
    env.payload = { ...env.payload, channel: 'internal-dryrun' };
    expect(verifyBotOutput(TEXT, env, reg, { now: NOW }).reasons).toContain('signature_invalid');
  });

  it('BLOCKS a signature from an unregistered key', () => {
    const other = makeBot();
    const env = signed(other.privateKey, other.entry);
    expect(verifyBotOutput(TEXT, env, reg, { now: NOW }).reasons).toContain('kid_not_registered');
  });

  it('BLOCKS a bot signing under another bot\'s name', () => {
    const env = signed(privateKey, entry, TEXT, { bot: 'authichain-marketing' });
    expect(verifyBotOutput(TEXT, env, reg, { now: NOW }).reasons).toContain('kid_bot_mismatch');
  });

  it('BLOCKS pending and revoked keys', () => {
    const revoked = registryOf({ ...entry, status: 'revoked', revoked_at: '2026-10-01T00:00:00Z' });
    const r = verifyBotOutput(TEXT, signed(privateKey, entry), revoked, { now: NOW });
    expect(r.reasons).toEqual(expect.arrayContaining(['key_revoked', 'signed_after_revocation']));
  });

  it('BLOCKS a channel the bot is not registered for', () => {
    const env = signed(privateKey, entry, TEXT, { channel: 'email' });
    expect(verifyBotOutput(TEXT, env, reg, { now: NOW }).reasons).toContain('channel_not_allowed');
  });

  it('BLOCKS when the ledger time is more than 10 minutes from the signed ts', () => {
    const env = signed(privateKey, entry);
    const r = verifyBotOutput(TEXT, env, reg, { now: NOW, ledgerTs: '2026-10-09T16:10:01.000Z' });
    expect(r.reasons).toContain('ts_ledger_skew');
    expect(verifyBotOutput(TEXT, env, reg, { now: NOW, ledgerTs: '2026-10-09T16:10:00.000Z' }).ok).toBe(true);
  });

  it('BLOCKS when the gate requires a ledger time and none is given', () => {
    const r = verifyBotOutput(TEXT, signed(privateKey, entry), reg, { now: NOW, requireLedgerTs: true });
    expect(r.reasons).toContain('ts_ledger_skew');
  });

  it('BLOCKS future-dated signatures', () => {
    const env = signed(privateKey, entry, TEXT, { ts: '2026-10-09T16:05:00.000Z' });
    expect(verifyBotOutput(TEXT, env, reg, { now: NOW }).reasons).toContain('ts_in_future');
  });

  it('BLOCKS unknown payload fields and garbage envelopes (fails closed)', () => {
    const env = signed(privateKey, entry, TEXT, { extra: 'x' });
    expect(verifyBotOutput(TEXT, env, reg, { now: NOW }).reasons).toContain('payload_unknown_field:extra');
    expect(verifyBotOutput(TEXT, null, reg).ok).toBe(false);
    expect(verifyBotOutput(TEXT, { alg: 'EdDSA', sig: '!!', payload: {} }, reg).ok).toBe(false);
  });

  it('live bytes must match the signed hash', () => {
    const env = signed(privateKey, entry);
    expect(checkLiveBytes(TEXT, env).ok).toBe(true);
    expect(checkLiveBytes(TEXT + ' ', env).ok).toBe(false);
  });
});

describe('registry and JWKS pin', () => {
  it('rejects the root /.well-known/jwks.json (serves the attestation key, not bot keys)', () => {
    const reg = { ...registryOf(), jwks_url: 'https://authichain.com/.well-known/jwks.json' };
    expect(validateRegistry(reg)).toEqual(
      expect.arrayContaining(['registry_jwks_url_not_pinned', 'registry_jwks_url_forbidden']),
    );
  });

  it('rejects private key material in the registry', () => {
    const { entry } = makeBot();
    const bad = registryOf({ ...entry, publicJwk: { ...entry.publicJwk, d: 'secret' } });
    expect(validateRegistry(bad)).toContain('registry_private_material:grok-bot');
  });

  it('the committed registry is valid, pinned, and holds no keys yet', () => {
    const reg = JSON.parse(readFileSync(join(HERE, 'registry.json'), 'utf8'));
    expect(validateRegistry(reg)).toEqual([]);
    expect(reg.jwks_url).toBe('https://authichain.com/api/v1/.well-known/bot-jwks.json');
    for (const b of reg.bots) {
      expect(b.status).toBe('pending');
      expect(b.publicJwk).toBeNull();
      expect(b.secret_name).toBe(botKeySecretName(b.bot));
    }
  });

  it('PIN.json matches bot-output.mjs byte for byte', () => {
    const pin = JSON.parse(readFileSync(join(HERE, 'PIN.json'), 'utf8'));
    const actual = createHash('sha256').update(readFileSync(join(HERE, 'bot-output.mjs'))).digest('hex');
    expect(actual).toBe(pin.verifier_sha256);
  });
});

describe('ledger', () => {
  function line(prev, seq, over = {}) {
    return makeLedgerLine(prev, seq, {
      ts: NOW, bot: 'grok-bot', channel: 'x', kind: 'dry-run', kid: 'k',
      content_sha256: 'a'.repeat(64), envelope_sha256: 'b'.repeat(64), verdict: 'pass',
      reasons: [], verifier_sha256: 'c'.repeat(64), ref: 'ops/dogfood/pieces/x', ...over,
    });
  }

  it('accepts a well-formed hash chain', () => {
    const l1 = line(null, 1);
    const l2 = line(l1, 2);
    expect(checkLedger(`${l1}\n${l2}\n`)).toEqual([]);
  });

  it('detects an edited line (chain breaks on the next one)', () => {
    const l1 = line(null, 1);
    const l2 = line(l1, 2);
    const edited = l1.replace('"pass"', '"fail"');
    expect(checkLedger(`${edited}\n${l2}\n`)).toContain('line2:chain_broken');
  });

  it('append-only: base lines must survive unchanged', () => {
    const l1 = line(null, 1);
    const l2 = line(l1, 2);
    expect(checkAppendOnly(`${l1}\n`, `${l1}\n${l2}\n`)).toEqual([]);
    expect(checkAppendOnly(`${l1}\n${l2}\n`, `${l1}\n`)).toEqual(['ledger_truncated']);
    expect(checkAppendOnly(`${l1}\n`, `${line(null, 1, { verdict: 'fail' })}\n`)).toEqual(['ledger_rewritten:line1']);
  });

  it('committed ledger is valid', () => {
    expect(checkLedger(readFileSync(join(HERE, '..', '..', 'ops', 'dogfood', 'ledger.jsonl'), 'utf8'))).toEqual([]);
  });
});

describe('qualify (Advisor ruling Oct 9)', () => {
  const DAY = 86_400_000;
  const start = Date.parse('2026-10-10T12:00:00.000Z');
  function ledger(kinds) {
    let prev = null;
    const out = [];
    kinds.forEach(([kind, verdict, dayOffset], i) => {
      const l = makeLedgerLine(prev, i + 1, {
        ts: new Date(start + dayOffset * DAY).toISOString(), bot: 'grok-bot', channel: 'x', kind, kid: 'k',
        content_sha256: 'a'.repeat(64), envelope_sha256: 'b'.repeat(64), verdict, reasons: [],
        verifier_sha256: 'c'.repeat(64), ref: 'r',
      });
      out.push(l);
      prev = l;
    });
    return out.join('\n') + '\n';
  }
  const passes = (n, days) => Array.from({ length: n }, (_, i) => ['dry-run', 'pass', (days * i) / (n - 1)]);

  it('20 passes over 7 days + a failed tamper copy = eligible for Auditor, never unlocked', () => {
    const r = qualify(ledger([...passes(20, 7), ['tamper-test', 'fail', 7]]), 'grok-bot', 'x');
    expect(r).toMatchObject({ eligible_for_auditor: true, unlocked: false, streak: 20, mode: 'initial' });
  });

  it('19 passes is not enough; 20 in 6 days is not enough', () => {
    expect(qualify(ledger([...passes(19, 7), ['tamper-test', 'fail', 7]]), 'grok-bot', 'x').eligible_for_auditor).toBe(false);
    expect(qualify(ledger([...passes(20, 6), ['tamper-test', 'fail', 6]]), 'grok-bot', 'x').eligible_for_auditor).toBe(false);
  });

  it('one failure resets the streak', () => {
    const r = qualify(ledger([...passes(19, 6), ['dry-run', 'fail', 6.5], ['dry-run', 'pass', 7], ['tamper-test', 'fail', 7]]), 'grok-bot', 'x');
    expect(r.streak).toBe(1);
    expect(r.eligible_for_auditor).toBe(false);
  });

  it('missing tamper test, or a tamper copy that PASSED, blocks', () => {
    expect(qualify(ledger(passes(20, 7)), 'grok-bot', 'x').reasons).toContain('tamper_test_missing');
    expect(qualify(ledger([...passes(20, 7), ['tamper-test', 'pass', 7]]), 'grok-bot', 'x').reasons).toContain('tamper_copy_passed');
  });

  it('a live failure re-locks: requalify needs 10 over 3 days after it', () => {
    const rows = [...passes(20, 7), ['tamper-test', 'fail', 7], ['live', 'pass', 8], ['live', 'fail', 9]];
    expect(qualify(ledger(rows), 'grok-bot', 'x')).toMatchObject({ mode: 'requalify', eligible_for_auditor: false });
    const re = Array.from({ length: 10 }, (_, i) => ['dry-run', 'pass', 9.1 + (3 * i) / 9]);
    const r = qualify(ledger([...rows, ...re, ['tamper-test', 'fail', 12.2]]), 'grok-bot', 'x');
    expect(r).toMatchObject({ mode: 'requalify', streak: 10, eligible_for_auditor: true });
  });
});
