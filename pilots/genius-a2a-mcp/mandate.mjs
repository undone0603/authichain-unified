import { createHmac, timingSafeEqual } from 'node:crypto';

export const METHODS = Object.freeze(['genius_sources_list','genius_evidence_verify','genius_manifest_build','genius_report_get']);
const isPlain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const validIso = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === new Date(Date.parse(s)).toISOString();
const canonical = x => JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b]) => a.localeCompare(b, 'en'))));
export const signMandate = (body, key) => createHmac('sha256', key).update(canonical(body)).digest('hex');
export function validateMandate(envelope, { key, now, seen, origin, method, requester }) {
  if (!isPlain(envelope) || !isPlain(envelope.body) || typeof envelope.signature !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature)) throw Error('Invalid signed envelope');
  if (!Buffer.isBuffer(key) || key.length < 32) throw Error('Invalid verifier key');
  if (!Number.isSafeInteger(now) || !seen || typeof seen.has !== 'function' || typeof seen.add !== 'function') throw Error('Invalid verification context');
  const b = envelope.body;
  if (Object.keys(b).sort().join(',') !== ['budgetCents','expiresAt','issuedAt','maxRequests','methods','nonce','origins','requester','scope','taskId','version'].sort().join(',')) throw Error('Unexpected mandate fields');
  if (b.version !== 1 || b.scope !== 'public-only' || b.budgetCents !== 0 || !Number.isSafeInteger(b.maxRequests) || b.maxRequests < 1 || b.maxRequests > 20) throw Error('Mandate scope violation');
  if (!validIso(b.issuedAt) || !validIso(b.expiresAt)) throw Error('Invalid mandate time');
  const issued=Date.parse(b.issuedAt), expires=Date.parse(b.expiresAt);
  if (issued > now + 30000 || expires <= now || expires - issued > 15*60*1000) throw Error('Expired or excessive mandate');
  if (typeof b.requester !== 'string' || b.requester !== requester || b.requester.length > 160) throw Error('Requester mismatch');
  if (typeof b.taskId !== 'string' || !/^[a-zA-Z0-9_-]{12,96}$/.test(b.taskId) || typeof b.nonce !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(b.nonce)) throw Error('Invalid replay identifiers');
  if (!Array.isArray(b.methods) || b.methods.length < 1 || b.methods.length > METHODS.length || new Set(b.methods).size !== b.methods.length || b.methods.some(x=>!METHODS.includes(x)) || !b.methods.includes(method)) throw Error('Method denied');
  if (!Array.isArray(b.origins) || b.origins.length < 1 || b.origins.length > 5 || new Set(b.origins).size !== b.origins.length || !b.origins.includes(origin)) throw Error('Origin denied');
  for(const item of b.origins) { const u = new URL(item); if(u.protocol !== 'https:' || u.origin !== item || u.username || u.password || u.port || u.hostname === 'localhost' || u.hostname.endsWith('.local') || u.hostname.endsWith('.internal') || /^[0-9.]+$/.test(u.hostname) || u.hostname.startsWith('[')) throw Error('Unsafe origin'); }
  const expected=signMandate(b,key), provided=Buffer.from(envelope.signature,'hex');
  if (!timingSafeEqual(Buffer.from(expected,'hex'),provided)) throw Error('Bad mandate signature');
  const replayKey=b.requester+':'+b.taskId+':'+b.nonce;
  if(seen.has(replayKey)) throw Error('Replay rejected');
  seen.add(replayKey);
  return Object.freeze({ authorized:true, taskId:b.taskId, maxRequests:b.maxRequests, expiresAt:b.expiresAt });
}
// This validator does not authorize fetches, contract signing, agency access, or tool execution.
// Production needs persistent atomic replay store and asymmetric signer trust configuration.
