#!/usr/bin/env node
/** Offline intake preflight for an opt-in, free-only AuthiChain MCP demonstration.
 * No network, secrets, signing, payment, adoption counting, or identity attestation.
 * A passing preflight is NEVER independent operator acceptance.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const FREE_ENDPOINT = 'https://authichain.com/mcp/free';
export const DEMO_ID = 'polygon-anchor-1';
const SCHEMA = 'authichain-free-mcp-reproduction/v1';
const ALLOWED_FIELDS = new Set([
  'transport', 'version', 'checkedAtUtc', 'demoOnly', 'verdict',
  'signatureOrAnchorOutcome', 'onChain', 'paidCalls', 'userDataTransmitted', 'limitation',
]);

export function validateSubmission(submission, resultBytes, { now = Date.now() } = {}) {
  const problems = [];
  const reject = code => problems.push(code);
  const data = submission && typeof submission === 'object' && !Array.isArray(submission)
    ? submission : {};
  const operator = data.operator ?? {};
  const client = data.client ?? {};
  const execution = data.execution ?? {};
  const safe = b => typeof b === 'string' && b.trim().length > 0;
  const sha40 = /^[a-f0-9]{40}$/i;
  const sha256 = /^[a-f0-9]{64}$/i;
  const name = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37})$/;

  if (data.schema !== SCHEMA || data.protocol !== 'mcp') reject('WRONG_SCHEMA_OR_PROTOCOL');
  if (!name.test(operator.github ?? '') || ['undone0603', 'z-kie'].includes((operator.github ?? '').toLowerCase())) {
    reject('EXTERNAL_OPERATOR_UNCONFIRMED');
  }
  if (operator.unaffiliated !== true || operator.consentToPublish !== true) reject('NO_INDEPENDENT_CONSENT');
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(client.repoUrl ?? '') ||
      !sha40.test(client.commitSha ?? '') || !safe(client.runtime)) reject('CLIENT_PROVENANCE_INCOMPLETE');
  if (execution.command !== 'node scripts/agent-adoption/free-record-smoke.mjs' ||
      execution.endpoint !== FREE_ENDPOINT || execution.tool !== 'verify_record' ||
      execution.demoId !== DEMO_ID || !sha256.test(execution.resultSha256 ?? '')) {
    reject('OUTSIDE_FREE_DEMO_SCOPE');
  }

  const bytes = Buffer.isBuffer(resultBytes) ? resultBytes : Buffer.from(resultBytes ?? '');
  if (!bytes.length || bytes.length > 16384) reject('RESULT_SIZE_INVALID');
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== execution.resultSha256?.toLowerCase()) reject('RESULT_DIGEST_MISMATCH');
  const text = bytes.toString('utf8');
  if (/Authorization\s*[:=]\s*Bearer|PAYMENT-SIGNATURE\s*[:=]|BEGIN\s+(?:RSA |EC |OPENSSH )?PRIVATE KEY|\bsk_(?:live|test)_[A-Za-z0-9]+|\bx-api-key\s*[:=]\s*\S+/i.test(text)) {
    reject('POTENTIAL_SECRET_IN_RESULT');
  }

  let result;
  try { result = JSON.parse(text); } catch { reject('RESULT_JSON_INVALID'); }
  if (!result || typeof result !== 'object' || Array.isArray(result) ||
      Object.keys(result).some(k => !ALLOWED_FIELDS.has(k))) reject('RESULT_SHAPE_INVALID');
  else {
    if (result.transport !== 'MCP JSON-RPC POST (read-only)' || result.demoOnly !== true ||
        result.paidCalls !== 0 || result.userDataTransmitted !== false) reject('NOT_FREE_READ_ONLY');
    if (!['verified', 'unverified', 'invalid', 'indeterminate'].includes(result.verdict) ||
        !safe(result.version) || !safe(result.signatureOrAnchorOutcome) ||
        typeof result.onChain !== 'boolean' ||
        result.limitation !== 'Not independent evidence of physical product authenticity') {
      reject('VERDICT_OR_LIMITATION_INVALID');
    }
    const observed = Date.parse(result.checkedAtUtc);
    if (typeof result.checkedAtUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(result.checkedAtUtc) ||
        !Number.isFinite(observed) || observed > now + 600000 || now - observed > 30 * 86400000) {
      reject('OBSERVATION_TIME_INVALID');
    }
  }
  const unique = [...new Set(problems)];
  return {
    status: unique.length ? 'REJECTED' : 'REVIEW_REQUIRED',
    independentAdoptionCounted: false,
    scope: 'MCP_FREE_DEMO_ONLY',
    resultSha256: digest,
    problems: unique,
    reviewRequired: [
      'Verify GitHub submitter identity and consent against the issue author.',
      'Independently fetch the pinned client commit and compare source/run command.',
      'Inspect redacted HTTP evidence or independently reproduce the authorized free call.',
      'Corroborate request/response IDs, HTTP status and tool result; stdout alone is self-report.',
      'Record a distinct reviewer acceptance URL before counting an independent operator.',
    ],
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.length !== 4) {
    console.error('Usage: node scripts/agent-adoption/validate-independent-receipt.mjs submission.json free-result.json');
    process.exitCode = 2;
  } else {
    try {
      const receipt = JSON.parse(readFileSync(process.argv[2], 'utf8'));
      const bytes = readFileSync(process.argv[3]);
      const verdict = validateSubmission(receipt, bytes);
      console.log(JSON.stringify(verdict, null, 2));
      if (verdict.status !== 'REVIEW_REQUIRED') process.exitCode = 1;
    } catch (error) {
      console.error('REJECTED:', error.message);
      process.exitCode = 1;
    }
  }
}
