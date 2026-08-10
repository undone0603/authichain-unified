/**
 * AuthiChain Scan-Validate Worker
 * Cloudflare Worker for /api/qron/scan-validate
 *
 * Fetches a generated QRON image, decodes the QR payload,
 * stores the scan result in D1, and returns scannable status.
 */

export interface Env {
  DB: D1Database
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface ScanRequest {
  asset_url: string
  registration_id: string
}

/**
 * Lightweight QR detection via an external QR decode API.
 * We call a free QR decode service as a serverless-friendly alternative
 * to bundling WASM decoders into the worker.
 */
async function decodeQR(imageUrl: string): Promise<{ decoded: string | null; confidence: number }> {
  // Strategy 1: Use goqr.me decode API (free, no auth)
  try {
    const apiUrl = `https://api.qrserver.com/v1/read-qr-code/?fileurl=${encodeURIComponent(imageUrl)}`
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const data = await res.json() as Array<{ symbol: Array<{ data: string | null; error: string | null }> }>
      const symbol = data?.[0]?.symbol?.[0]
      if (symbol?.data && !symbol.error) {
        return { decoded: symbol.data, confidence: 0.95 }
      }
    }
  } catch {
    // Fall through to next strategy
  }

  // Strategy 2: Attempt Google Vision-style decode via zxing online
  try {
    const zxingUrl = `https://zxing.org/w/decode?u=${encodeURIComponent(imageUrl)}`
    const res = await fetch(zxingUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'text/html' },
    })
    if (res.ok) {
      const html = await res.text()
      // Extract decoded text from the result page
      const match = html.match(/<pre>([^<]+)<\/pre>/)
      if (match?.[1]) {
        return { decoded: match[1].trim(), confidence: 0.85 }
      }
    }
  } catch {
    // Fall through
  }

  return { decoded: null, confidence: 0 }
}

async function handleScanValidate(request: Request, env: Env): Promise<Response> {
  let body: ScanRequest
  try {
    body = await request.json() as ScanRequest
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { asset_url, registration_id } = body

  if (!asset_url || !registration_id) {
    return Response.json(
      { error: 'asset_url and registration_id are required' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // Validate URL format
  try {
    new URL(asset_url)
  } catch {
    return Response.json(
      { error: 'Invalid asset_url' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // Decode QR from the image
  const { decoded, confidence } = await decodeQR(asset_url)
  const scannable = decoded !== null ? 1 : 0

  // Write result to D1
  const id = crypto.randomUUID()
  try {
    await env.DB.prepare(
      `INSERT INTO qron_scan_results (id, qron_registration_id, asset_url, decoded_payload, confidence, scannable)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, registration_id, asset_url, decoded, confidence, scannable)
      .run()
  } catch (err) {
    console.error('D1 write error:', err)
    // Non-fatal — still return the scan result
  }

  return Response.json(
    {
      id,
      scannable: Boolean(scannable),
      decoded,
      confidence,
      registration_id,
    },
    { status: 200, headers: CORS_HEADERS }
  )
}

async function handleGetScanResult(url: URL, env: Env): Promise<Response> {
  const registrationId = url.searchParams.get('registration_id')
  if (!registrationId) {
    return Response.json(
      { error: 'registration_id query param required' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const result = await env.DB.prepare(
    'SELECT * FROM qron_scan_results WHERE qron_registration_id = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(registrationId)
    .first()

  if (!result) {
    return Response.json(
      { error: 'No scan result found' },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  return Response.json(
    {
      id: result.id,
      scannable: Boolean(result.scannable),
      decoded: result.decoded_payload,
      confidence: result.confidence,
      registration_id: result.qron_registration_id,
      created_at: result.created_at,
    },
    { status: 200, headers: CORS_HEADERS }
  )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)

    // Health check
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return Response.json(
        { status: 'ok', worker: 'authichain-scan-validate', ts: Date.now() },
        { headers: CORS_HEADERS }
      )
    }

    // POST /api/qron/scan-validate — run scan validation
    if (url.pathname.startsWith('/api/qron/scan-validate') && request.method === 'POST') {
      return handleScanValidate(request, env)
    }

    // GET /api/qron/scan-validate?registration_id=... — fetch existing result
    if (url.pathname.startsWith('/api/qron/scan-validate') && request.method === 'GET') {
      return handleGetScanResult(url, env)
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS })
  },
}
