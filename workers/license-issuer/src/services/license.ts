/**
 * License JWT generation using ECDSA P-256.
 *
 * Format:  <base64url(payload)>.<base64url(signature)>
 *
 * This is the signing counterpart to src/license.ts in agent-browser,
 * which verifies keys using the matching public key.
 *
 * Generate a key pair:
 *   openssl ecparam -name prime256v1 -genkey -noout -out license-private.pem
 *   openssl ec -in license-private.pem -pubout -out license-public.pem
 *   wrangler secret put LICENSE_PRIVATE_KEY_PEM   < license-private.pem
 *   wrangler secret put LICENSE_PUBLIC_KEY_PEM    < license-public.pem
 */

import type { Env } from '../index'
import type { LicenseTier } from './db'

export interface LicensePayload {
  sub: string        // email
  tier: LicenseTier
  seats: number      // 0 = unlimited
  exp: number        // unix seconds
  iat: number
  jti: string        // unique ID for this key
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function toBase64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
    (c) => c.charCodeAt(0)
  )
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

/**
 * Issue a signed license key for a given customer.
 */
export async function issueLicenseKey(
  env: Env,
  payload: LicensePayload
): Promise<string> {
  const privateKey = await importPrivateKey(env.LICENSE_PRIVATE_KEY_PEM)

  const payloadB64 = toBase64url(JSON.stringify(payload))
  const data = new TextEncoder().encode(payloadB64)

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  )

  return `${payloadB64}.${base64url(signature)}`
}

/**
 * Hash a key for storage — we never store the raw key.
 */
export async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Determine tier from a Stripe price ID.
 */
export function tierFromPriceId(env: Env, priceId: string): LicenseTier {
  if (priceId === env.STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID) return 'enterprise'
  return 'pro'
}

/**
 * Seats for each tier (0 = unlimited).
 */
export function seatsForTier(tier: LicenseTier): number {
  // 0 = unlimited seats. Pro gets a fixed seat allowance; Enterprise is unrestricted.
  return tier === 'enterprise' ? 0 : 5
}
