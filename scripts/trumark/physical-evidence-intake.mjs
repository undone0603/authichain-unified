#!/usr/bin/env node
/**
 * TruMark offline physical-evidence intake — non-issuing, read-only validation.
 * Never issues a credential, authenticates a physical item, or contacts a service.
 * All file paths and examiner assertions are untrusted input.
 */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INTAKE_SCHEMA = 'authichain.trumark.physical-evidence-intake.v0.1';
export const EVIDENCE_ONLY = 'EVIDENCE_ONLY_UNVERIFIED';
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const NONCE = /^TRM-[A-F0-9]{32}$/;
const MAX_EVIDENCE_BYTES = 30 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function filled(v) { return typeof v === 'string' && v.trim().length > 0 && v.length <= 512; }
function utcDate(v) { return typeof v === 'string' && ISO_UTC.test(v) && Number.isFinite(Date.parse(v)); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function secureFile(rootDir, file) {
  if (!filled(file) || path.isAbsolute(file) || file.includes('\\') || file.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('unsafe_relative_path');
  }
  const root = realpathSync(rootDir);
  const candidate = path.resolve(root, file);
  const resolved = realpathSync(candidate);
  if (!resolved.startsWith(root + path.sep)) throw new Error('file_outside_evidence_root');
  // Reject a symbolic link at the final component, even if it points inside root.
  if (!lstatSync(candidate).isFile()) throw new Error('not_regular_file');
  const stat = lstatSync(resolved);
  if (!stat.isFile() || stat.size < 1 || stat.size > MAX_EVIDENCE_BYTES) throw new Error('evidence_file_size_invalid');
  return readFileSync(resolved);
}

/**
 * @param {unknown} manifest untrusted private intake JSON
 * @param {{rootDir:string, now?:string}} options
 * @returns {object} Redacted integrity gate, NEVER physical authenticity.
 */
export function validatePhysicalEvidenceIntake(manifest, { rootDir, now = new Date().toISOString() } = {}) {
  const errors = [];
  const digests = {};
  const add = (name, ok) => { if (!ok) errors.push(name); };
  if (!isObj(manifest)) {
    return { accepted: false, status: EVIDENCE_ONLY, nextGate: 'COMPLETE_PRIVATE_INTAKE', errors: ['manifest_required'] };
  }
  add('invalid_schema', manifest.schemaVersion === INTAKE_SCHEMA);
  add('observation_id_required', filled(manifest.observationId) && /^urn:authichain:pilot:[a-zA-Z0-9:._-]{8,160}$/.test(manifest.observationId));
  const c = manifest.challenge;
  add('challenge_required', isObj(c));
  add('challenge_nonce_invalid', typeof c?.nonce === 'string' && NONCE.test(c.nonce));
  add('challenge_id_required', filled(c?.id));
  for (const [field, value] of [['issued', c?.issuedAt], ['expires', c?.expiresAt], ['captured', c?.capturedAt], ['examined', manifest.examiner?.examinedAt]]) {
    add(field + '_time_invalid', utcDate(value));
  }
  add('review_time_invalid', utcDate(now));
  if (utcDate(c?.issuedAt) && utcDate(c?.expiresAt) && utcDate(c?.capturedAt)) {
    const issued = Date.parse(c.issuedAt), expires = Date.parse(c.expiresAt), captured = Date.parse(c.capturedAt);
    add('challenge_time_order_invalid', issued < expires && issued <= captured && captured <= expires);
  }
  add('capture_nonce_not_reported', c?.nonceObserved === c?.nonce && !!c?.nonce);
  const examiner = manifest.examiner;
  add('examiner_business_required', filled(examiner?.business));
  add('examiner_person_required', filled(examiner?.person));
  add('examiner_attribution_required', filled(examiner?.attributionReference));
  const method = manifest.method;
  add('test_method_required', filled(method?.name));
  add('instrument_required', filled(method?.instrument));
  add('packaging_state_required', ['sealed', 'opened', 'unknown'].includes(method?.packagingState));
  add('method_scope_required', filled(method?.scope));
  add('method_limitations_required', filled(method?.limitations));
  const report = manifest.report;
  add('report_scope_required', filled(report?.scope));
  add('report_limitations_required', filled(report?.limitations));
  add('report_claims_recorded', typeof report?.findings === 'string' && report.findings.length > 0 && report.findings.length <= 2000);
  add('report_issuer_reference_required', filled(report?.claimedIssuer));
  // An unsigned/self-reported manifest cannot elevate trust under any field spelling.
  const forbidden = ['authenticated', 'manufacturerAuthenticated', 'manufacturerIssuerVerified', 'elementVerified', 'platinumVerified', 'physicalAuthenticityProven', 'issuerVerified'];
  add('self_authentication_forbidden', !forbidden.some(k => manifest[k] === true || report?.[k] === true || examiner?.[k] === true));
  add('verification_status_forbidden', !['VERIFIED', 'ACTIVE', 'AUTHENTIC', 'MANUFACTURER_AUTHENTICATED'].includes(manifest.status));
  add('evidence_root_required', filled(rootDir));
  const files = [ ['capture', c?.media], ['report', report?.evidence] ];
  const seen = new Set();
  for (const [type, ref] of files) {
    if (!isObj(ref) || !filled(ref.file) || !SHA256.test(ref.sha256 ?? '')) {
      errors.push(type + '_reference_invalid');
      continue;
    }
    if (seen.has(ref.file)) { errors.push('evidence_paths_must_be_distinct'); continue; }
    seen.add(ref.file);
    if (!filled(rootDir)) continue;
    try {
      const bytes = secureFile(rootDir, ref.file);
      const actual = sha256(bytes);
      if (actual !== ref.sha256) errors.push(type + '_sha256_mismatch');
      else digests[type] = actual;
    } catch (e) {
      errors.push(type + '_file_' + (e?.message === 'unsafe_relative_path' || e?.message === 'file_outside_evidence_root' || e?.message === 'not_regular_file' || e?.message === 'evidence_file_size_invalid' ? e.message : 'unavailable'));
    }
  }
  return {
    accepted: errors.length === 0,
    status: EVIDENCE_ONLY,
    physicalAuthenticity: 'NOT_ESTABLISHED',
    manufacturerAuthentication: 'NOT_ESTABLISHED',
    examinerAuthority: 'UNREVIEWED',
    reportClaimStatus: 'UNREVIEWED',
    nextGate: errors.length ? 'COMPLETE_PRIVATE_INTAKE' : 'INDEPENDENT_EXAMINER_AND_ISSUER_REVIEW',
    errors,
    evidenceSha256: digests,
    notice: 'Byte integrity and submitted field completeness only. No independent source authority, elemental composition, custody or physical authenticity was verified.',
  };
}

function cli() {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3) {
    process.stderr.write('Usage: node scripts/trumark/physical-evidence-intake.mjs <private-manifest.json>\n');
    process.exitCode = 2;
    return;
  }
  try {
    const p = path.resolve(input);
    const st = lstatSync(p);
    if (!st.isFile() || st.size < 1 || st.size > MAX_MANIFEST_BYTES) throw new Error('manifest_size_invalid');
    const manifest = JSON.parse(readFileSync(p, 'utf8'));
    const result = validatePhysicalEvidenceIntake(manifest, { rootDir: path.dirname(p) });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (!result.accepted) process.exitCode = 1;
  } catch (e) {
    process.stderr.write('private manifest could not be processed: ' + (e?.message === 'manifest_size_invalid' ? 'invalid size' : 'invalid/missing JSON') + '\n');
    process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
