import { createHash } from 'node:crypto';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function manifest({ sourceUrl, observedAt, content, authorizationSource = null, status = 'observed' }) {
  const u = new URL(sourceUrl);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) throw Error('Canonical HTTPS source required');
  if (u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || u.hostname.endsWith('.local') || u.hostname.endsWith('.internal') || /^\d+\\.\d+\\.\d+\\.\d+$/.test(u.hostname) || u.hostname.startsWith('[')) throw Error('IP and local hostnames are not allowed');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(observedAt) || !Number.isFinite(Date.parse(observedAt))) throw Error('UTC observation time required');
  if (!observedAt.endsWith('Z')) throw Error('UTC Z suffix required');
  if (!['observed', 'not_found', 'inconclusive', 'not_tested'].includes(status)) throw Error('Invalid evidence state');
  if (status !== 'observed' && content !== null) throw Error('Only observed content can be hashed');
  if (status === 'observed' && !(content instanceof Uint8Array)) throw Error('Observed content must be bytes');
  return { schema: 'authichain.genius.evidence.v0.1', sourceUrl: u.toString(), observedAt, status,
    sha256: status === 'observed' ? digest(content) : null,
    authorizationSource, complianceVerdict: null, reservesVerified: false };
}
