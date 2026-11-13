#!/usr/bin/env node
// Offline A2A AgentCard evidence auditor. No network, credentials, or task submission.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

export function auditCard(raw, { expectedOrigin = 'https://authichain.com' } = {}) {
  const sha256 = createHash('sha256').update(raw).digest('hex');
  const failures = [];
  let card;
  try { card = JSON.parse(raw); } catch { return { sha256, pass: false, failures: ['invalid_json'], observations: {} }; }
  if (!card || typeof card !== 'object' || Array.isArray(card)) failures.push('invalid_object');
  const obj = card && typeof card === 'object' && !Array.isArray(card) ? card : {};
  if (typeof obj.name !== 'string' || !obj.name.trim()) failures.push('missing_name');
  const interfaces = Array.isArray(obj.supportedInterfaces) ? obj.supportedInterfaces : [];
  if (!interfaces.length) failures.push('missing_supported_interfaces');
  for (const entry of interfaces) {
    if (!entry || typeof entry !== 'object') { failures.push('malformed_interface'); continue; }
    const url = entry.url;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.origin !== expectedOrigin || parsed.username || parsed.password) failures.push('untrusted_interface_url');
    } catch { failures.push('invalid_interface_url'); }
    if (typeof entry.protocolBinding !== 'string' || !entry.protocolBinding) failures.push('missing_protocol_binding');
    if (typeof entry.protocolVersion !== 'string' || !entry.protocolVersion) failures.push('missing_protocol_version');
  }
  const declaredSecurity = obj.securitySchemes && typeof obj.securitySchemes === 'object';
  const observations = {
    name: typeof obj.name === 'string' ? obj.name : null,
    declaredVersion: typeof obj.version === 'string' ? obj.version : null,
    interfaces: interfaces.map(i => ({
      protocolBinding: i?.protocolBinding ?? null,
      protocolVersion: i?.protocolVersion ?? null,
      // No raw URL/credentials in the report.
      sameOriginHttps: (() => { try { const u = new URL(i?.url); return u.origin === expectedOrigin && u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } })(),
    })),
    securitySchemesDeclared: Boolean(declaredSecurity),
    signedCardPresent: Boolean(obj.signatures && Array.isArray(obj.signatures) && obj.signatures.length),
  };
  return { sha256, pass: failures.length === 0, failures: [...new Set(failures)], observations,
    limitations: 'Static local card-shape and same-origin audit only; NOT official A2A schema/TCK conformance, live transport, signed-card validation, task success or independent peer adoption.' };
}

export function selfTest() {
  const good = JSON.stringify({name:'AuthiChain',version:'1.0',supportedInterfaces:[{url:'https://authichain.com/api/a2a',protocolBinding:'JSONRPC',protocolVersion:'1.0'}]});
  test('accepts a local same-origin discovery fixture without claiming conformance', () => {
    const result = auditCard(good); assert.equal(result.pass,true); assert.match(result.limitations,/NOT official/);
  });
  test('fails closed on malformed JSON', () => assert.deepEqual(auditCard('{').failures,['invalid_json']));
  test('rejects missing interfaces', () => assert.ok(auditCard('{"name":"x"}').failures.includes('missing_supported_interfaces')));
  test('rejects foreign or insecure endpoints', () => {
    for(const url of ['http://authichain.com/api/a2a','https://example.org/api/a2a','https://user:pass@authichain.com/api/a2a']) {
      const c=JSON.stringify({name:'x',supportedInterfaces:[{url,protocolBinding:'JSONRPC',protocolVersion:'1.0'}]});
      assert.equal(auditCard(c).pass,false);
    }
  });
  test('rejects missing version or binding', () => {
    const c=JSON.stringify({name:'x',supportedInterfaces:[{url:'https://authichain.com/api/a2a'}]});
    assert.equal(auditCard(c).pass,false);
  });
  test('hashes exact original bytes', () => assert.equal(auditCard(good).sha256,createHash('sha256').update(good).digest('hex')));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv[2] === '--self-test') selfTest();
  else if (process.argv.length === 3) {
    const result = auditCard(readFileSync(process.argv[2],'utf8'));
    console.log(JSON.stringify(result,null,2));
    if (!result.pass) process.exitCode=1;
  } else {
    console.error('Usage: node scripts/alliances/a2a-card-offline-audit.mjs <downloaded-card.json> | --self-test');
    process.exitCode=2;
  }
}
