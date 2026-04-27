/**
 * Stripe webhook signature verification.
 * Reimplements Stripe's HMAC-SHA256 tolerance-window check for the Workers runtime.
 */
export async function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string
): Promise<boolean> {
  if (!header) return false

  // Parse header: t=<timestamp>,v1=<sig1>[,v1=<sig2>...]
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=') as [string, string])
  )
  const timestamp = parts['t']
  const signatures = header.match(/v1=([a-f0-9]+)/g)?.map((s) => s.slice(3)) ?? []
  if (!timestamp || signatures.length === 0) return false

  // Reject if older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false

  const payload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return signatures.some((s) => s === expected)
}
