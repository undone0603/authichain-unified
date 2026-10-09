// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as edSign, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildPayload, payloadSigningBytes, verifyBotOutput, validateRegistry, checkLiveBytes,
  makeLedgerLine, checkLedger, checkAppendOnly, qualify, jwkThumbprint, botKeySecretName,
  PINNED_JWKS_URL, checkDryRunEvidence, POSTAL_ADDRESS, EU_PRIVACY_URL, sha256Hex,
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
  // Every dry run gets its own bytes, a stored piece, and a claims-gate PASS on its hash.
  function ledger(kinds, channel = 'x', over = () => ({})) {
    let prev = null;
    const out = [];
    const pieces = new Map();
    kinds.forEach(([kind, verdict, dayOffset], i) => {
      const body = `piece ${i + 1}\n`;
      const sha = sha256Hex(body);
      const ref = `ops/dogfood/pieces/${sha}-${i + 1}`;
      pieces.set(ref, body);
      const l = makeLedgerLine(prev, i + 1, {
        ts: new Date(start + dayOffset * DAY).toISOString(), bot: 'grok-bot', channel, kind, kid: 'k',
        content_sha256: sha, envelope_sha256: 'b'.repeat(64), verdict, reasons: [],
        verifier_sha256: 'c'.repeat(64), ref,
        claims_gate: { id: 'AE-20261009-RES-154', verdict: 'PASS', content_sha256: sha },
        ...over(i + 1, sha),
      });
      out.push(l);
      prev = l;
    });
    return { text: out.join('\n') + '\n', readPiece: (e) => pieces.get(e.ref), pieces };
  }
  const q = (l, channel = 'x') => qualify(l.text, 'grok-bot', channel, { readPiece: l.readPiece });
  const passes = (n, days) => Array.from({ length: n }, (_, i) => ['dry-run', 'pass', (days * i) / (n - 1)]);

  it('20 passes over 7 days + a failed tamper copy = eligible for Auditor, never unlocked', () => {
    const r = q(ledger([...passes(20, 7), ['tamper-test', 'fail', 7]]));
    expect(r).toMatchObject({ eligible_for_auditor: true, unlocked: false, streak: 20, mode: 'initial', rejected_dry_runs: [] });
  });

  it('19 passes is not enough; 20 in 6 days is not enough', () => {
    expect(q(ledger([...passes(19, 7), ['tamper-test', 'fail', 7]])).eligible_for_auditor).toBe(false);
    expect(q(ledger([...passes(20, 6), ['tamper-test', 'fail', 6]])).eligible_for_auditor).toBe(false);
  });

  it('one failure resets the streak', () => {
    const r = q(ledger([...passes(19, 6), ['dry-run', 'fail', 6.5], ['dry-run', 'pass', 7], ['tamper-test', 'fail', 7]]));
    expect(r.streak).toBe(1);
    expect(r.eligible_for_auditor).toBe(false);
  });

  it('missing tamper test, or a tamper copy that PASSED, blocks', () => {
    expect(q(ledger(passes(20, 7))).reasons).toContain('tamper_test_missing');
    expect(q(ledger([...passes(20, 7), ['tamper-test', 'pass', 7]])).reasons).toContain('tamper_copy_passed');
  });

  it('a live failure re-locks: requalify needs 10 over 3 days after it', () => {
    const rows = [...passes(20, 7), ['tamper-test', 'fail', 7], ['live', 'pass', 8], ['live', 'fail', 9]];
    expect(q(ledger(rows))).toMatchObject({ mode: 'requalify', eligible_for_auditor: false });
    const re = Array.from({ length: 10 }, (_, i) => ['dry-run', 'pass', 9.1 + (3 * i) / 9]);
    const r = q(ledger([...rows, ...re, ['tamper-test', 'fail', 12.2]]));
    expect(r).toMatchObject({ mode: 'requalify', streak: 10, eligible_for_auditor: true });
  });

  // ── Evidence (ADM-144, MKT-93, RES-154) ────────────────────────────────────
  const ok20 = [...passes(20, 7), ['tamper-test', 'fail', 7]];

  it('fails closed with no piece reader: no dry run counts', () => {
    const l = ledger(ok20);
    const r = qualify(l.text, 'grok-bot', 'x');
    expect(r.eligible_for_auditor).toBe(false);
    expect(r.streak).toBe(0);
    expect(r.rejected_dry_runs[0].reasons).toContain('piece_missing');
  });

  it('a dry run with NO claims-gate PASS fails and resets the streak (posts)', () => {
    const r = q(ledger(ok20, 'x', (seq) => (seq === 10 ? { claims_gate: undefined } : {})));
    expect(r.eligible_for_auditor).toBe(false);
    expect(r.streak).toBe(10);
    expect(r.rejected_dry_runs).toEqual([{ seq: 10, reasons: ['claims_gate_missing'] }]);
  });

  it('a claims-gate PASS on a MISMATCHED hash does not count', () => {
    const r = q(ledger(ok20, 'x', (seq) => (seq === 20
      ? { claims_gate: { id: 'AE-20261009-RES-154', verdict: 'PASS', content_sha256: 'd'.repeat(64) } }
      : {})));
    expect(r.eligible_for_auditor).toBe(false);
    expect(r.rejected_dry_runs).toEqual([{ seq: 20, reasons: ['claims_gate_hash_mismatch'] }]);
  });

  it('a non-PASS verdict or a malformed gate id does not count', () => {
    const r = q(ledger(ok20, 'x', (seq, sha) => (seq === 5
      ? { claims_gate: { id: 'RES-154', verdict: 'FAIL', content_sha256: sha } }
      : {})));
    expect(r.rejected_dry_runs[0].reasons).toEqual(expect.arrayContaining(['claims_gate_id', 'claims_gate_not_pass']));
    expect(r.eligible_for_auditor).toBe(false);
  });

  it('a TAMPERED stored copy (bytes no longer match the logged hash) fails', () => {
    const l = ledger(ok20);
    const ref = [...l.pieces.keys()][14];
    l.pieces.set(ref, l.pieces.get(ref).replace('piece', 'p1ece'));
    const r = q(l);
    expect(r.eligible_for_auditor).toBe(false);
    expect(r.rejected_dry_runs).toEqual([{ seq: 15, reasons: ['piece_hash_mismatch'] }]);
  });

  it('a gate copied from another piece (gate hash = other content) fails even with valid bytes', () => {
    const other = sha256Hex('some other gated copy\n');
    const r = q(ledger(ok20, 'x', (seq) => (seq === 1
      ? { claims_gate: { id: 'AE-20261009-RES-154', verdict: 'PASS', content_sha256: other } }
      : {})));
    expect(r.rejected_dry_runs[0]).toEqual({ seq: 1, reasons: ['claims_gate_hash_mismatch'] });
  });

  describe('email musts', () => {
    const OPT = 'https://authichain.com/unsubscribe?t=abc123';
    const goodBody = (eu) => `Hi,\nShort note.\n\n${POSTAL_ADDRESS}\nUnsubscribe: ${OPT}\n${eu ? `Privacy (EU/UK): ${EU_PRIVACY_URL}\n` : ''}`;
    const checks = (over = {}) => ({
      dnc: { list: '/workspace/reports/legal/DO-NOT-CONTACT.md', list_sha256: 'e'.repeat(64), recipient_sha256: 'f'.repeat(64), listed: false },
      opt_out: { url: OPT, http_status: 200 },
      eu_recipient: false,
      ...over,
    });
    const entry = (body, ec, gateSha) => {
      const sha = sha256Hex(body);
      return {
        channel: 'email', content_sha256: sha,
        claims_gate: { id: 'AE-20261009-RES-154', verdict: 'PASS', content_sha256: gateSha ?? sha },
        ...(ec === undefined ? {} : { email_checks: ec }),
      };
    };

    it('a complete email passes (non-EU and EU)', () => {
      expect(checkDryRunEvidence(entry(goodBody(false), checks()), goodBody(false))).toEqual([]);
      expect(checkDryRunEvidence(entry(goodBody(true), checks({ eu_recipient: true })), goodBody(true))).toEqual([]);
    });

    it('repo copy of the DNC list is accepted; any other path is not', () => {
      const b = goodBody(false);
      expect(checkDryRunEvidence(entry(b, checks({ dnc: { ...checks().dnc, list: 'ops/legal/DO-NOT-CONTACT.md' } })), b)).toEqual([]);
      expect(checkDryRunEvidence(entry(b, checks({ dnc: { ...checks().dnc, list: '/tmp/dnc.md' } })), b)).toContain('dnc_list_path');
    });

    it('no DNC check, or a listed recipient, fails', () => {
      const b = goodBody(false);
      expect(checkDryRunEvidence(entry(b, checks({ dnc: undefined })), b)).toContain('dnc_check_missing');
      expect(checkDryRunEvidence(entry(b, checks({ dnc: { ...checks().dnc, listed: true } })), b)).toContain('dnc_listed_or_unknown');
      expect(checkDryRunEvidence(entry(b, undefined), b)).toContain('email_checks_missing');
    });

    it('no footer postal address fails', () => {
      const b = goodBody(false).replace(POSTAL_ADDRESS, 'Roscommon, MI');
      expect(checkDryRunEvidence(entry(b, checks()), b)).toContain('postal_address_missing');
    });

    it('no opt-out link, or one that did not return 2xx, fails', () => {
      const b = goodBody(false).replace(`Unsubscribe: ${OPT}\n`, '');
      expect(checkDryRunEvidence(entry(b, checks()), b)).toEqual(expect.arrayContaining(['opt_out_link_missing']));
      const b2 = goodBody(false);
      expect(checkDryRunEvidence(entry(b2, checks({ opt_out: { url: OPT, http_status: 404 } })), b2)).toContain('opt_out_not_working');
      expect(checkDryRunEvidence(entry(b2, checks({ opt_out: undefined })), b2)).toContain('opt_out_missing');
      expect(checkDryRunEvidence(entry(b2, checks({ opt_out: { url: 'https://authichain.com/unsubscribe?t=other', http_status: 200 } })), b2))
        .toContain('opt_out_link_not_checked');
    });

    it('EU recipient without the /privacy#eu-uk link fails; unknown EU status fails', () => {
      const b = goodBody(false);
      expect(checkDryRunEvidence(entry(b, checks({ eu_recipient: true })), b)).toContain('eu_privacy_link_missing');
      expect(checkDryRunEvidence(entry(b, checks({ eu_recipient: undefined })), b)).toContain('eu_recipient_unknown');
    });

    it('email still needs the claims gate on the exact hash; a tampered copy fails', () => {
      const b = goodBody(false);
      expect(checkDryRunEvidence(entry(b, checks(), 'a'.repeat(64)), b)).toContain('claims_gate_hash_mismatch');
      expect(checkDryRunEvidence(entry(b, checks()), b.replace('Short', 'Sh0rt'))).toContain('piece_hash_mismatch');
    });

    it('qualify on the email channel: one email missing its footer breaks the streak', () => {
      const body = goodBody(false);
      // Every line logs the same complete email body, so only the stored bytes differ.
      const text = (() => {
        let prev = null;
        return ok20.map(([kind, verdict, d], i) => {
          const sha = sha256Hex(body);
          const line = makeLedgerLine(prev, i + 1, {
            ts: new Date(start + d * DAY).toISOString(), bot: 'grok-bot', channel: 'email', kind, kid: 'k',
            content_sha256: sha, envelope_sha256: 'b'.repeat(64), verdict, reasons: [], verifier_sha256: 'c'.repeat(64),
            ref: `ops/dogfood/pieces/p${i + 1}`,
            claims_gate: { id: 'AE-20261009-RES-154', verdict: 'PASS', content_sha256: sha },
            email_checks: checks(),
          });
          prev = line;
          return line;
        }).join('\n') + '\n';
      })();
      const good = qualify(text, 'grok-bot', 'email', { readPiece: () => body });
      expect(good).toMatchObject({ eligible_for_auditor: true, streak: 20 });
      // Same ledger, but piece 12's stored bytes lack the postal address (tampered copy).
      const noFooter = body.replace(POSTAL_ADDRESS, '');
      const bad = qualify(text, 'grok-bot', 'email', { readPiece: (e) => (e.seq === 12 ? noFooter : body) });
      expect(bad.eligible_for_auditor).toBe(false);
      expect(bad.rejected_dry_runs).toEqual([{ seq: 12, reasons: ['piece_hash_mismatch'] }]);
    });
  });
});
