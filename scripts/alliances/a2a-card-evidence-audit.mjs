#!/usr/bin/env node
/** Offline A2A Agent Card evidence audit. Descriptor presence is NOT a task handshake. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWED_HOST = 'authichain.com';
const A2A_PATH = '/api/a2a';
function httpsTarget(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === ALLOWED_HOST &&
      url.pathname === A2A_PATH && !url.username && !url.password &&
      !url.search && !url.hash && url.port === '';
  } catch { return false; }
}
export function auditAgentCard(card) {
  const failures = [];
  const add = s => failures.push(s);
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    return { status: 'REJECTED', failures: ['NOT_JSON_OBJECT'], descriptorOnly: true,
      a2aTaskAccepted: false, externalIntegrationCounted: false };
  }
  if (typeof card.name !== 'string' || !card.name.trim()) add('NAME_MISSING');
  if (typeof card.version !== 'string' || !card.version.trim()) add('CARD_VERSION_MISSING');
  if (!Array.isArray(card.skills) || !card.skills.length ||
      card.skills.some(s => !s || typeof s.id !== 'string' || !s.id.trim() ||
        typeof s.name !== 'string' || !s.name.trim())) add('SKILLS_INVALID');
  const interfaces = Array.isArray(card.supportedInterfaces) ? card.supportedInterfaces : [];
  // A top-level url is optional metadata, never a replacement for declared
  // supportedInterfaces. If present, validate it even if another binding is valid.
  if (card.url !== undefined && !httpsTarget(card.url)) add('UNEXPECTED_TARGET');
  if (!interfaces.length) add('NO_INTERFACE');
  if (interfaces.some(i => !i || typeof i !== 'object' || Array.isArray(i) || !httpsTarget(i.url))) {
    add('UNEXPECTED_TARGET');
  }
  if (!interfaces.some(i => i && typeof i === 'object' && !Array.isArray(i) &&
    i.protocolBinding === 'JSONRPC' && i.protocolVersion === '1.0' && httpsTarget(i.url))) {
    add('NO_EXPECTED_JSONRPC_V1_INTERFACE');
  }
  if (card.capabilities && (typeof card.capabilities !== 'object' || Array.isArray(card.capabilities))) add('CAPABILITIES_INVALID');
  return {
    status: failures.length ? 'REJECTED' : 'DESCRIPTOR_REVIEW_REQUIRED',
    failures: [...new Set(failures)], descriptorOnly: true,
    a2aTaskAccepted: false, externalIntegrationCounted: false,
    requiredNextEvidence: ['UTC HTTP GET status and raw card SHA-256', 'Pinned official A2A schema validation',
      'Consent-authorized JSON-RPC request/response with matching IDs and task lifecycle',
      'External operator identity and separate acceptance decision'],
  };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/alliances/a2a-card-evidence-audit.mjs agent-card.json (offline)');
    process.exitCode = 2;
  } else {
    try {
      const card = JSON.parse(readFileSync(process.argv[2], 'utf8'));
      const result = auditAgentCard(card);
      console.log(JSON.stringify(result, null, 2));
      if (result.status === 'REJECTED') process.exitCode = 1;
    } catch (error) {
      console.error('REJECTED:', error.message);
      process.exitCode = 1;
    }
  }
}
