#!/usr/bin/env node
// Offline intake preflight only: this cannot independently certify operator identity,
// on-chain settlement, service fulfillment, or protocol conformance.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const sha256 = s => createHash('sha256').update(s).digest('hex');
const hex64 = x => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);
const txHash = x => typeof x === 'string' && /^0x[a-f0-9]{64}$/i.test(x);
const https = x => { try { return new URL(x).protocol === 'https:'; } catch { return false; } };
const sourcePins = new Set([
  '76a36fe68d5d8bbadb0a7bea9ac1166819c7f51f',
  '4d9d9b8c02a5e53eb34e88ce3d8ad1dc53e283af'
]);
export function assess(e) {
  const errors = [];
  const need = (ok, why) => { if (!ok) errors.push(why); };
  need(e && typeof e === 'object' && !Array.isArray(e), 'object_required');
  if (!e || typeof e !== 'object') return { state: 'rejected', reasons: errors };
  need(['mcp', 'a2a', 'x402'].includes(e.kind), 'unknown_kind');
  need(https(e.evidenceUrl), 'https_evidence_url_required');
  need(typeof e.observedAt === 'string' && !Number.isNaN(Date.parse(e.observedAt)) && /(?:Z|[+-]\d\d:\d\d)$/.test(e.observedAt), 'utc_or_offset_timestamp_required');
  need(hex64(e.artifactSha256), 'artifact_sha256_required');
  if (e.kind === 'mcp' || e.kind === 'a2a') {
    need(sourcePins.has(e.sourceSha), 'merged_source_sha_required');
    need(typeof e.operator === 'string' && e.operator.trim().length > 0, 'operator_attribution_required');
    need(e.consentToPublish === true, 'explicit_publication_consent_required');
    need(https(e.traceUrl), 'https_trace_url_required');
    need(typeof e.runtime === 'string' && e.runtime.trim().length > 0, 'runtime_required');
    need(typeof e.httpStatus === 'number' && e.httpStatus >= 100 && e.httpStatus <= 599, 'http_status_required');
  }
  if (e.kind === 'x402') {
    need(txHash(e.transactionHash), 'base_transaction_hash_required');
    need(e.chainId === 8453, 'base_chain_id_required');
    need(e.asset === 'USDC', 'usdc_asset_required');
    need(typeof e.payerAddress === 'string' && /^0x[a-f0-9]{40}$/i.test(e.payerAddress), 'payer_address_required');
    need(https(e.fulfillmentEvidenceUrl), 'fulfillment_evidence_url_required');
    need(e.houseClassification === 'non-house', 'non_house_attribution_required');
  }
  // Even complete submissions require a separately authenticated independent reviewer.
  return { state: errors.length ? 'incomplete' : 'review_required', reasons: errors,
    artifactFingerprint: hex64(e.artifactSha256) ? e.artifactSha256.toLowerCase() : null };
}
function selfTest() {
  const base = { kind:'mcp', evidenceUrl:'https://example.org/evidence', observedAt:'2026-11-13T07:00:00Z', artifactSha256:sha256('fixture'), sourceSha:[...sourcePins][0], operator:'independent-example', consentToPublish:true, traceUrl:'https://example.org/trace', runtime:'node 22', httpStatus:200 };
  assert.equal(assess(base).state, 'review_required');
  assert.equal(assess({...base, consentToPublish:false}).state, 'incomplete');
  assert.equal(assess({...base, sourceSha:'main'}).state, 'incomplete');
  assert.equal(assess({...base, artifactSha256:'not-a-hash'}).state, 'incomplete');
  assert.equal(assess({...base, traceUrl:'http://example.org/trace'}).state, 'incomplete');
  assert.equal(assess({...base, kind:'x402'}).state, 'incomplete');
  assert.equal(assess({...base, kind:'unknown'}).state, 'incomplete');
  assert.equal(assess(null).state, 'rejected');
  console.log('8 offline preflight tests passed; no external acceptance certified');
}
if (process.argv.includes('--self-test')) selfTest();
else if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  if (!process.argv[2]) { console.error('usage: node independent-evidence-preflight.mjs evidence.json'); process.exitCode=2; }
  else { try { console.log(JSON.stringify(assess(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2)); }
    catch(e) { console.error('invalid_input:',e.message); process.exitCode=2; } }
}
