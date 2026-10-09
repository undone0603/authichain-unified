#!/usr/bin/env node
/**
 * DOGFOOD-IDENTITY-V1 command line. Exit 0 = pass, 1 = BLOCKED / fail, 2 = usage.
 *
 *   node protocol/dogfood/cli.mjs verify   --content F --envelope F [--ledger-ts ISO] [--registry F]
 *   node protocol/dogfood/cli.mjs live     --content F --envelope F
 *   node protocol/dogfood/cli.mjs append   --kind dry-run|tamper-test|live --content F --envelope F [--ledger F]
 *                                           [--claims-gate-id AE-YYYYMMDD-RES-N --claims-gate-sha256 HEX]
 *                                           [--email-checks F.json]
 *   node protocol/dogfood/cli.mjs ledger-check [--ledger F] [--base F]
 *   node protocol/dogfood/cli.mjs qualify  --bot B --channel C [--ledger F]
 *
 * qualify reads each dry run's stored bytes from ops/dogfood/pieces/ (via the
 * ledger line's ref) and fails any dry run without a Research claims-gate PASS
 * on that exact sha256, or (email) without DNC/postal/opt-out/EU-link evidence.
 *
 * Every verify first checks that bot-output.mjs matches PIN.json, so a bot
 * cannot pass by editing the verifier it is checked by.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { readFileSync, appendFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyBotOutput, checkLiveBytes, checkLedger, checkAppendOnly, qualify,
  makeLedgerLine, parseLedger, sha256Hex,
} from './bot-output.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const DEFAULT_REGISTRY = join(HERE, 'registry.json');
const DEFAULT_LEDGER = join(ROOT, 'ops', 'dogfood', 'ledger.jsonl');

export function verifierSha256() {
  return sha256Hex(readFileSync(join(HERE, 'bot-output.mjs')));
}

export function checkPin() {
  const pin = JSON.parse(readFileSync(join(HERE, 'PIN.json'), 'utf8'));
  const actual = verifierSha256();
  return actual === pin.verifier_sha256 ? [] : [`verifier_pin_mismatch:${actual}`];
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1], i++;
    else out._.push(argv[i]);
  }
  return out;
}

function print(obj, ok) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(ok ? 0 : 1);
}

function runVerify(a, extra = {}) {
  const pin = checkPin();
  if (pin.length) return { ok: false, reasons: pin, checks: {} };
  const registry = JSON.parse(readFileSync(a.registry ?? DEFAULT_REGISTRY, 'utf8'));
  const content = readFileSync(a.content);
  const envelope = JSON.parse(readFileSync(a.envelope, 'utf8'));
  return verifyBotOutput(content, envelope, registry, { ledgerTs: a['ledger-ts'], ...extra });
}

function main(argv) {
  const a = args(argv);
  const cmd = a._[0];
  try {
    if (cmd === 'verify') {
      if (!a.content || !a.envelope) throw new Error('usage');
      const r = runVerify(a);
      return print(r, r.ok);
    }
    if (cmd === 'live') {
      if (!a.content || !a.envelope) throw new Error('usage');
      const r = checkLiveBytes(readFileSync(a.content), JSON.parse(readFileSync(a.envelope, 'utf8')));
      return print(r, r.ok);
    }
    if (cmd === 'ledger-check') {
      const ledger = a.ledger ?? DEFAULT_LEDGER;
      const text = existsSync(ledger) ? readFileSync(ledger, 'utf8') : '';
      const reasons = checkLedger(text);
      if (a.base && existsSync(a.base)) reasons.push(...checkAppendOnly(readFileSync(a.base, 'utf8'), text));
      return print({ ok: reasons.length === 0, lines: parseLedger(text).length, reasons }, reasons.length === 0);
    }
    if (cmd === 'qualify') {
      if (!a.bot || !a.channel) throw new Error('usage');
      const ledger = a.ledger ?? DEFAULT_LEDGER;
      const piecesDir = resolve(dirname(resolve(ledger)), 'pieces');
      const readPiece = (e) => {
        if (typeof e.ref !== 'string') return undefined;
        const f = resolve(ROOT, `${e.ref}.txt`);
        if (!f.startsWith(piecesDir + '/') || !existsSync(f)) return undefined;
        return readFileSync(f);
      };
      const r = qualify(existsSync(ledger) ? readFileSync(ledger, 'utf8') : '', a.bot, a.channel, { readPiece });
      return print(r, r.eligible_for_auditor);
    }
    if (cmd === 'append') {
      if (!a.content || !a.envelope || !['dry-run', 'tamper-test', 'live'].includes(a.kind)) throw new Error('usage');
      const ledger = a.ledger ?? DEFAULT_LEDGER;
      const now = new Date().toISOString();
      const r = runVerify(a, { ledgerTs: now });
      const envelope = JSON.parse(readFileSync(a.envelope, 'utf8'));
      const contentSha = sha256Hex(readFileSync(a.content));
      const pieces = join(dirname(resolve(ledger)), 'pieces');
      mkdirSync(pieces, { recursive: true });
      const stem = join(pieces, `${contentSha}-${envelope.payload?.nonce ?? 'x'}`);
      copyFileSync(a.content, `${stem}.txt`);
      copyFileSync(a.envelope, `${stem}.envelope.json`);
      const text = existsSync(ledger) ? readFileSync(ledger, 'utf8') : '';
      const rows = parseLedger(text);
      const line = makeLedgerLine(rows.at(-1)?.raw ?? null, rows.length + 1, {
        ts: now,
        bot: envelope.payload?.bot ?? 'unknown',
        channel: envelope.payload?.channel ?? 'internal-dryrun',
        kind: a.kind,
        kid: envelope.payload?.kid ?? '',
        content_sha256: contentSha,
        envelope_sha256: sha256Hex(readFileSync(a.envelope)),
        verdict: r.ok ? 'pass' : 'fail',
        reasons: r.reasons,
        verifier_sha256: verifierSha256(),
        ref: relative(ROOT, stem),
        ...(a['claims-gate-id'] || a['claims-gate-sha256']
          ? { claims_gate: { id: a['claims-gate-id'] ?? '', verdict: 'PASS', content_sha256: a['claims-gate-sha256'] ?? '' } }
          : {}),
        ...(a['email-checks'] ? { email_checks: JSON.parse(readFileSync(a['email-checks'], 'utf8')) } : {}),
      });
      appendFileSync(ledger, line + '\n');
      // A tamper-test is SUPPOSED to fail; the command succeeds when it does.
      const expected = a.kind === 'tamper-test' ? !r.ok : r.ok;
      return print({ appended: JSON.parse(line), ...r }, expected);
    }
    throw new Error('usage');
  } catch (err) {
    if (err.message === 'usage') {
      console.error('usage: cli.mjs verify|live|append|ledger-check|qualify ... (see header)');
      process.exit(2);
    }
    print({ ok: false, reasons: [`cli_error:${err.message}`] }, false);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
