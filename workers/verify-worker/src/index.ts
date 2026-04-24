/**
 * AuthiChain Verify Worker
 * Cloudflare Worker for the /api/verify endpoint
 * Handles product verification requests at the edge
 */

export interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  NEXT_PUBLIC_SITE_URL: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function normalizeProductIdentifier(value: string): string {
  return value.trim().toUpperCase()
}

function deriveInputIdentifier(input: string): string {
  const trimmed = input.trim()
  if (!isLikelyUrl(trimmed)) {
    return normalizeProductIdentifier(trimmed)
  }
  try {
    const parsed = new URL(trimmed)
    const idParam = parsed.searchParams.get('id')
    if (idParam) return normalizeProductIdentifier(idParam)
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const lastSegment = pathParts[pathParts.length - 1]
    return normalizeProductIdentifier(lastSegment || trimmed)
  } catch {
    return normalizeProductIdentifier(trimmed)
  }
}

interface SupabaseProduct {
  id: number
  product_identifier: string
  is_active: boolean
  name?: string
  supply_chain?: unknown
  token_id?: number
  industry_id?: string
  workflow?: unknown
  story?: string
  features?: unknown
  confidence?: string
  authenticity_features?: unknown
}

async function lookupProduct(
  identifier: string,
  env: Env
): Promise<SupabaseProduct | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/products?product_identifier=eq.${encodeURIComponent(identifier)}&limit=1`
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) return null
  const rows = await response.json() as SupabaseProduct[]
  return rows.length > 0 ? rows[0] : null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)

    // Health check
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return Response.json(
        { status: 'ok', worker: 'authichain-verify-worker', ts: Date.now() },
        { headers: CORS_HEADERS }
      )
    }

    // Only handle /api/verify
    if (!url.pathname.startsWith('/api/verify')) {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS })
    }

    // Parse input from GET ?input= or POST body
    let rawInput = ''
    if (request.method === 'GET') {
      rawInput = url.searchParams.get('input') || url.searchParams.get('id') || ''
    } else if (request.method === 'POST') {
      try {
        const body = await request.json() as { input?: string; id?: string; qrCode?: string }
        rawInput = body.input || body.id || body.qrCode || ''
      } catch {
        return Response.json(
          { error: 'Invalid JSON body' },
          { status: 400, headers: CORS_HEADERS }
        )
      }
    }

    if (!rawInput.trim()) {
      return Response.json(
        { error: 'Missing input parameter' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Derive product identifier
    const identifier = deriveInputIdentifier(rawInput)

    // Lookup product in Supabase
    let product: SupabaseProduct | null = null
    try {
      product = await lookupProduct(identifier, env)
    } catch (err) {
      console.error('Supabase lookup error:', err)
    }

    const authentic = product !== null && product.is_active !== false
    const trustScore = authentic ? 96 : product !== null ? 30 : 10
    const confidence: 'High' | 'Medium' | 'Low' =
      trustScore >= 80 ? 'High' : trustScore >= 40 ? 'Medium' : 'Low'

    const viewModel = {
      result: authentic ? 'authentic' : 'counterfeit',
      authentic,
      trust_score: trustScore,
      confidence,
      qron_id: product?.product_identifier || identifier,
      actions: authentic
        ? ['launch_ar', 'view_story', 'claim_ownership']
        : ['retry_scan', 'contact_support'],
      product: product
        ? {
            productIdentifier: product.product_identifier,
            isActive: product.is_active,
            name: product.name,
            industryId: product.industry_id,
            story: product.story,
            workflow: product.workflow,
            features: product.features,
            authenticityFeatures: product.authenticity_features,
          }
        : null,
      supplyChain: product?.supply_chain ?? null,
      tokenId: typeof product?.token_id === 'number' ? product.token_id : null,
      success: authentic,
      message: authentic ? 'Verified' : product !== null ? 'Product inactive' : 'Product not found',
      verifiedAt: new Date().toISOString(),
      input: rawInput,
    }

    return Response.json(viewModel, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': authentic ? 's-maxage=60, stale-while-revalidate=300' : 'no-store',
      },
    })
  },
}
