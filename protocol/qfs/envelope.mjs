/**
 * QFS-ready settlement envelope for AuthiChain records.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * There is no public "Quantum Financial System" network, API, or SWIFT
 * replacement to dial. What this module does is the part that is real:
 *
 *   1. Map a signed AuthiChain provenance record into an ISO 20022
 *      pacs.008 (FIToFICustomerCreditTransfer) JSON document, with the
 *      Verifiable Credential in SplmtryData — the same slot banks use
 *      for structured remittance.
 *   2. Stamp a dual digest (SHA-256 + SHA-512) so a later NIST FIPS 204
 *      ML-DSA-65 signature can sit next to today's Ed25519 without
 *      rewriting the envelope.
 *   3. Verify that envelope offline. No AuthiChain server. No fictional
 *      quantum ledger.
 *
 * Usage:
 *   import { toPacs008, verifyEnvelope } from './envelope.mjs';
 *   node envelope.mjs record.json
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalize, sha256Hex, verifyRecord, signingBytes } from '../verifier.mjs';

export const QFS_PROFILE = 'authichain-qfs-iso20022-v1';
export const ISO20022_MSG = 'pacs.008.001.08';

/** Dual digest. SHA-512 is the PQC-transition stand-in until ML-DSA-65 lands. */
export function hybridDigest(bytes) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const sha512 = createHash('sha512').update(bytes).digest('hex');
  return {
    sha256: `sha256:${sha256}`,
    sha512: `sha512:${sha512}`,
    pqcAlg: 'ML-DSA-65',
    pqcStatus: 'reserved',
    pqcNote:
      'NIST FIPS 204 ML-DSA-65 slot. Classical Ed25519 remains the production signature until a FIPS-validated ML-DSA implementation is wired into protocol/attestation.',
  };
}

function subjectOf(record) {
  return record?.credentialSubject ?? {};
}

function uetrFromHash(hex) {
  const h = hex.replace(/^sha256:/, '').padEnd(32, '0').slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Build an ISO 20022 pacs.008 JSON document wrapping a provenance record.
 * Amount defaults to 0 USD — this is an attestation carriage, not a wire.
 */
export function toPacs008(record, opts = {}) {
  if (!record || typeof record !== 'object') {
    throw new Error('record required');
  }
  const sub = subjectOf(record);
  const bytes = signingBytes(record);
  const digest = hybridDigest(bytes);
  const now = opts.created ?? new Date().toISOString();
  const amt = opts.amount ?? '0';
  const ccy = opts.currency ?? 'USD';
  const msgId = opts.msgId ?? `AC-${sha256Hex(bytes).slice(0, 16)}`;
  const e2e = String(sub.serial || sub.gtin || sub.id || msgId);

  return {
    profile: QFS_PROFILE,
    ISO20022: ISO20022_MSG,
    Document: {
      FIToFICstmrCdtTrf: {
        GrpHdr: {
          MsgId: msgId,
          CreDtTm: now,
          NbOfTxs: '1',
          CtrlSum: amt,
          SttlmInf: { SttlmMtd: 'CLRG' },
        },
        CdtTrfTxInf: {
          PmtId: {
            InstrId: msgId,
            EndToEndId: e2e,
            UETR: uetrFromHash(digest.sha256),
          },
          IntrBkSttlmAmt: { Ccy: ccy, _: amt },
          ChrgBr: 'SLEV',
          Dbtr: {
            Nm: 'AuthiChain issuer',
            Id: { OrgId: { Othr: { Id: record.issuer, SchmeNm: { Prtry: 'DID' } } } },
          },
          DbtrAgt: { FinInstnId: { Nm: 'AUTHICHAIN-PROTOCOL', Othr: { Id: 'authichain.com' } } },
          CdtrAgt: { FinInstnId: { Nm: 'AUTHICHAIN-VERIFY', Othr: { Id: 'authichain.com/verify' } } },
          Cdtr: {
            Nm: opts.creditorName ?? 'Bearer of item',
            Id: {
              OrgId: {
                Othr: {
                  Id: String(sub.id || sub.gtin || ''),
                  SchmeNm: { Prtry: 'GS1-DIGITAL-LINK' },
                },
              },
            },
          },
          RmtInf: {
            Ustrd: `AuthiChain provenance ${sub.gtin || ''} ${sub.serial || ''}`.trim(),
            Strd: {
              AddtlRmtInf: digest.sha256,
            },
          },
          SplmtryData: {
            PlcAndNm: '/Document/FIToFICstmrCdtTrf/CdtTrfTxInf/SplmtryData/Envlp',
            Envlp: {
              AuthiChain: {
                profile: QFS_PROFILE,
                record,
                digest,
                gtin: sub.gtin ?? null,
                serial: sub.serial ?? null,
                itemId: sub.id ?? null,
              },
            },
          },
        },
      },
    },
  };
}

export function extractRecord(envelope) {
  return (
    envelope?.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf?.SplmtryData?.Envlp?.AuthiChain
      ?.record ?? null
  );
}

/**
 * Offline verify: envelope shape + inner AuthiChain record + digest match.
 * Does not contact a bank, SWIFT, or any "QFS node".
 */
export function verifyEnvelope(envelope, anchor) {
  const reasons = [];
  if (!envelope || envelope.profile !== QFS_PROFILE) {
    reasons.push('unknown-or-missing-qfs-profile');
  }
  if (envelope?.ISO20022 !== ISO20022_MSG) {
    reasons.push('unexpected-iso20022-message');
  }
  const tx = envelope?.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf;
  const ac = tx?.SplmtryData?.Envlp?.AuthiChain;
  if (!ac?.record) {
    reasons.push('missing-authichain-record');
    return { ok: false, status: 'invalid', reasons, record: null };
  }
  const inner = verifyRecord(ac.record, anchor);
  if (inner.verdict === 'invalid') {
    reasons.push(`record:${inner.verdict}`);
    for (const r of inner.reasons ?? []) reasons.push(r);
  }
  const bytes = signingBytes(ac.record);
  const digest = hybridDigest(bytes);
  if (ac.digest?.sha256 !== digest.sha256) {
    reasons.push('digest-mismatch-sha256');
  }
  if (ac.digest?.sha512 !== digest.sha512) {
    reasons.push('digest-mismatch-sha512');
  }
  const uetr = tx?.PmtId?.UETR;
  if (uetr && uetr !== uetrFromHash(digest.sha256)) {
    reasons.push('uetr-mismatch');
  }
  const ok = reasons.length === 0 && inner.verdict !== 'invalid';
  return {
    ok,
    status: ok ? inner.verdict : 'invalid',
    reasons,
    recordStatus: inner.verdict,
    iso20022: ISO20022_MSG,
    uetr: uetr ?? null,
    digest,
    record: ac.record,
  };
}

export { canonicalize, sha256Hex };

function isMain() {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (isMain()) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node envelope.mjs record.json [anchor.json]');
    process.exit(2);
  }
  const record = JSON.parse(readFileSync(path, 'utf8'));
  const anchor = process.argv[3]
    ? JSON.parse(readFileSync(process.argv[3], 'utf8'))
    : undefined;
  const env = toPacs008(record, { msgId: randomUUID() });
  const verdict = verifyEnvelope(env, anchor);
  console.log(JSON.stringify({ envelope: env, verdict }, null, 2));
  process.exit(verdict.ok ? 0 : 1);
}
