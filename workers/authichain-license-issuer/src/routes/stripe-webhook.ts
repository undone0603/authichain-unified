import { verifyStripeSignature } from '../utils/crypto'
import { DB } from '../services/db'
import { issueLicenseKey, hashKey, tierFromPriceId, seatsForTier } from '../services/license'
import { notifyAdminNewLicense, deliverKeyViaTelegram } from '../services/telegram'
import type { Env } from '../index'

export async function stripeWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.text()
  const header = request.headers.get('Stripe-Signature')

  if (!(await verifyStripeSignature(body, header, env.STRIPE_WEBHOOK_SECRET))) {
    return new Response('Unauthorized', { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Idempotency guard
  if (await DB.isEventProcessed(env, event.id)) {
    return new Response(JSON.stringify({ status: 'already_processed' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  ctx.waitUntil(handleEvent(env, event))

  return new Response(JSON.stringify({ status: 'accepted' }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleEvent(env: Env, event: any): Promise<void> {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckout(env, event.data.object)
        break
      case 'customer.subscription.deleted':
        await handleCancellation(env, event.data.object)
        break
      default:
        break
    }
    await DB.logEvent(env, event.id, event.type, 'success', '')
  } catch (err: any) {
    await DB.logEvent(env, event.id, event.type, 'error', err?.message ?? String(err))
  }
}

async function handleCheckout(env: Env, session: any): Promise<void> {
  const priceId: string = session.line_items?.data?.[0]?.price?.id
    ?? session.metadata?.priceId
    ?? ''
  const email: string = session.customer_details?.email ?? session.customer_email ?? ''
  const customerId: string = session.customer ?? ''
  const subscriptionId: string = session.subscription ?? ''

  if (!email || !customerId) return

  const tier = tierFromPriceId(env, priceId)
  const seats = seatsForTier(tier)
  const jti = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const oneYear = now + 365 * 24 * 3600

  const key = await issueLicenseKey(env, {
    sub: email,
    tier,
    seats,
    exp: oneYear,
    iat: now,
    jti,
  })

  const keyHash = await hashKey(key)

  await DB.createLicense(env, {
    id: jti,
    email,
    tier,
    seats,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    key_hash: keyHash,
    status: 'active',
    expires_at: new Date(oneYear * 1000).toISOString(),
  })

  // Deliver key
  const deliveredViaTelegram = await deliverKeyViaTelegram(env, email, tier, key)
  if (deliveredViaTelegram) {
    await DB.markDelivered(env, jti)
  }
  // Always notify admin
  await notifyAdminNewLicense(env, email, tier, key)
}

async function handleCancellation(env: Env, subscription: any): Promise<void> {
  const customerId: string = subscription.customer ?? ''
  if (!customerId) return

  const record = await DB.getByStripeCustomer(env, customerId)
  if (record) {
    await DB.revoke(env, record.id)
  }
}
