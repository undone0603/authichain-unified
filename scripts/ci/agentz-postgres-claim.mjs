/** Host-injected PostgreSQL replay reservation. No DDL, credentials, or commercial writes. */
import { createHash } from 'node:crypto';
export const CLAIM_INSERT_SQL = `INSERT INTO agentz_commercial_replay_claims
  (claim_sha256, first_seen_at, minimum_retain_until)
  VALUES ($1, NOW(), NOW() + ($2::bigint * INTERVAL '1 millisecond'))
  ON CONFLICT (claim_sha256) DO NOTHING
  RETURNING claim_sha256`;
/** The unique claim MUST survive retention expiry; never reuse after ttlMs. */
export function createPostgresClaimOnce({ query }) {
 if (typeof query !== 'function') throw new TypeError('trusted PostgreSQL query binding required');
 return async (key, ttlMs) => {
  if (typeof key !== 'string' || !key.startsWith('agentz-commercial-attestation-v1:')) throw new TypeError('invalid claim namespace');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 86400000 || ttlMs > 31536000000) throw new TypeError('invalid retention horizon');
  const digest = createHash('sha256').update(key).digest('hex');
  const result = await query(CLAIM_INSERT_SQL, [digest, ttlMs]);
  if (!result || !Array.isArray(result.rows)) throw new Error('unverified database response');
  if (result.rows.length === 0) return false;
  if (result.rows.length !== 1 || result.rows[0]?.claim_sha256 !== digest) throw new Error('unexpected reservation response');
  return true;
 };
}
