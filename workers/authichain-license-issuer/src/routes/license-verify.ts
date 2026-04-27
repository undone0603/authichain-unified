import { DB } from '../services/db'
import { hashKey } from '../services/license'
import type { Env } from '../index'

/**
 * GET /api/license/verify?key=<key>
 * Public endpoint — returns tier and status for a given license key.
 * Used by CI systems or dashboards to validate keys without full offline JWT parsing.
 */
export async function licenseVerify(request: Request, env: Env): Promise<Response> {
  const key = new URL(request.url).searchParams.get('key')
  if (!key) {
    return Response.json({ error: 'Missing key parameter' }, { status: 400 })
  }

  const keyHash = await hashKey(key)
  const record = await DB.getByHash(env, keyHash)

  if (!record) {
    return Response.json({ valid: false, reason: 'Key not found' }, { status: 404 })
  }

  if (record.status === 'revoked') {
    return Response.json({ valid: false, reason: 'License revoked' }, { status: 200 })
  }

  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return Response.json({ valid: false, reason: 'License expired' }, { status: 200 })
  }

  return Response.json({
    valid: true,
    tier: record.tier,
    seats: record.seats,
    email: record.email,
    expires_at: record.expires_at,
  })
}
