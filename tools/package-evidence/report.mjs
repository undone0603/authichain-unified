/**
 * Offline-first packaging evidence intake for AuthiChain / StrainChain.
 * An observed package or decoded QR is NOT an issuer-authenticated product.
 * No network access, signing, Metrc access, CoA validation, or publication.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

const sha256 = data => createHash('sha256').update(data).digest('hex');
const safeText = (v, limit = 120) => typeof v === 'string' ? v.trim().slice(0, limit) : '';
const maskId = value => value.length < 4 ? '[REDACTED]' : `…${value.slice(-4)}`;

function unique(rows) { return [...new Set(rows)]; }

/** Input is a private source of observations. Report output redacts identifier values. */
export async function buildPackageEvidenceReport(input, { root = process.cwd() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Input must be an object');
  const caseId = safeText(input.case_id, 80);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/.test(caseId)) throw new Error('Invalid case_id');
  if (!Array.isArray(input.files) || !Array.isArray(input.observations)) {
    throw new Error('files and observations must be arrays');
  }
  const flags = [];
  const addFlag = (code, detail) => flags.push({ code, detail });
  const rootAbs = resolve(root);
  const files = [];
  const knownIds = new Set();
  for (const file of input.files) {
    const id = safeText(file?.id, 48);
    if (!/^[A-Za-z0-9_-]{1,48}$/.test(id) || knownIds.has(id)) throw new Error('Invalid or duplicate file id');
    knownIds.add(id);
    const path = safeText(file?.path, 512);
    const kind = ['photo', 'video', 'document'].includes(file?.kind) ? file.kind : 'unknown';
    if (!path || isAbsolute(path) || relative(rootAbs, resolve(rootAbs, path)).startsWith('..')) {
      addFlag('FILE_UNAVAILABLE', `${id}: invalid local-relative path`);
      files.push({ id, kind, status: 'UNAVAILABLE' });
      continue;
    }
    try {
      const bytes = await readFile(resolve(rootAbs, path));
      const digest = sha256(bytes);
      const claimed = safeText(file?.sha256, 64).toLowerCase();
      if (claimed && claimed !== digest) addFlag('FILE_HASH_MISMATCH', `${id}: claimed digest does not match bytes`);
      files.push({ id, kind, status: 'HASHED', bytes: bytes.length, sha256: digest });
    } catch {
      addFlag('FILE_UNAVAILABLE', `${id}: file not accessible`);
      files.push({ id, kind, status: 'UNAVAILABLE' });
    }
  }

  const observations = [];
  const idsByScope = new Map();
  for (const o of input.observations) {
    const sourceId = safeText(o?.source_id, 48);
    const field = safeText(o?.field, 64);
    const scope = safeText(o?.scope, 64);
    const value = safeText(o?.value, 512);
    if (!knownIds.has(sourceId) || !field || !scope || !value) {
      addFlag('INVALID_OBSERVATION', 'An observation lacks a known source, field, scope or value');
      continue;
    }
    const isIdentifier = /(^|_)(id|identifier|barcode|tracking|serial|tag)($|_)/i.test(field);
    observations.push({ source_id: sourceId, field, scope,
      observed: isIdentifier ? maskId(value) : value.slice(0, 100),
      kind: 'UNVERIFIED_LABEL_OBSERVATION' });
    if (isIdentifier) {
      const k = `${scope}|${field}`;
      idsByScope.set(k, [...(idsByScope.get(k) ?? []), value]);
    }
  }
  for (const [key, values] of idsByScope) {
    if (unique(values).length > 1) addFlag('CONFLICTING_OBSERVATIONS', `Different values for ${key}`);
  }
  // Identifiers on detached labels are not automatically claimed to belong to the pouch.
  const fieldScopes = new Map();
  for (const [key, values] of idsByScope) {
    const [scope, field] = key.split('|');
    fieldScopes.set(field, [...(fieldScopes.get(field) ?? []), { scope, values: unique(values) }]);
  }
  for (const [field, scopes] of fieldScopes) {
    if (scopes.length > 1 && unique(scopes.flatMap(s => s.values)).length > 1) {
      addFlag('CROSS_SCOPE_RECONCILIATION_REQUIRED', `${field}: labels may describe different items; obtain issuer linkage`);
    }
  }
  const qr = Array.isArray(input.qr_observations) ? input.qr_observations.map(q => ({
    source_id: safeText(q?.source_id, 48),
    decoded: Boolean(q?.decoded_payload),
    scheme: (() => { try { return new URL(q.decoded_payload).protocol.replace(':',''); } catch { return 'unknown'; } })(),
    issuer_verified: false,
  })) : [];
  if (qr.some(q => q.decoded)) addFlag('QR_NOT_AUTHORITY', 'A decoded URL alone cannot verify an issuer or package');
  if (!Array.isArray(input.coa_documents) || !input.coa_documents.length) {
    addFlag('COA_REQUIRED', 'No independent certificate of analysis was supplied for the genetics passport');
  }
  if (input.issuer_authorized !== true) {
    addFlag('ISSUER_AUTHORIZATION_REQUIRED', 'Issuer consent/authority is not established');
  }
  const report = {
    schema: 'authichain-package-evidence/1', case_id: caseId,
    issued_as: 'OBSERVATION_REPORT_NOT_CERTIFICATION',
    authentication_status: 'NOT_AUTHENTICATED',
    counterfeit_determination: 'NOT_DETERMINED',
    issuer_attestation_verified: false,
    state_traceability_verified: false,
    files, observations, qr, flags,
    intake: {
      issuer_authorized: input.issuer_authorized === true,
      coa_supplied: Array.isArray(input.coa_documents) && input.coa_documents.length > 0,
      ready_to_issue_passport: false,
      reason: 'Source review, issuer approval and signed issuance are separate controlled steps',
    },
    existing_offer: {
      name: 'StrainChain genetics passport — one cultivar',
      price_usd: 49,
      checkout: 'https://authichain.com/checkout/strainchain_passport',
      requires: 'Authorized issuer and independently reviewed CoAs; packaging evidence is supplementary',
    },
  };
  // The report digest is a fingerprint of its contents; it is NOT a digital signature.
  return { ...report, report_sha256: sha256(JSON.stringify(report)) };
}
