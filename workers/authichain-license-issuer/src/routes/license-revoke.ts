import { DB } from '../services/db'
import type { Env } from '../index'

/**
 * POST /api/license/revoke
 * Admin-only endpoint. Requires Authorization: Bearer <STRIPE_WEBHOOK_SECRET>.
 * Body: { "stripe_customer_id": "cus_..." }
 */
export async function licenseRevoke(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.STRIPE_WEBHOOK_SECRET}`) {
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
