import { DB } from '../services/db'
import type { Env } from '../index'

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

/**
 * POST /api/license/revoke
 * Admin-only endpoint. Requires Authorization: Bearer <STRIPE_WEBHOOK_SECRET>.
 * Body: { "stripe_customer_id": "cus_..." }
 */
export async function licenseRevoke(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') ?? ''
  if (!timingSafeEqual(auth, `Bearer ${env.STRIPE_WEBHOOK_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { stripe_customer_id } = body
  if (!stripe_customer_id) {
    return Response.json({ error: 'Missing stripe_customer_id' }, { status: 400 })
  }

  const record = await DB.getByStripeCustomer(env, stripe_customer_id)
  if (!record) {
    return Response.json({ error: 'License not found' }, { status: 404 })
  }

  await DB.revoke(env, record.id)
  return Response.json({ ok: true, revoked: record.id })
}
