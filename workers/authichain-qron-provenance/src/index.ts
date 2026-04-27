/**
 * AuthiChain QRON Provenance Worker
 * Cloudflare Worker for /api/qron-register
 *
 * Handles:
 *  - POST /api/qron-register — Register provenance for a generated QRON
 *  - GET  /api/qron-register?id=... — Fetch provenance record
 *  - POST /api/qron-register/mint — Update status to 'minted' with token_id + tx_hash
 */

export interface Env {
  DB: D1Database
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  AUTHICHAIN_API_SECRET?: string
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

interface RegisterRequest {
  user_id: string
  asset_url: string
  destination_url: string
  prompt?: string
  preset_id?: string
  mode?: string
  fal_request_id?: string
}

interface MintUpdateRequest {
  registration_id: string
  token_id: string
  tx_hash: string
  chain?: string
  contract_address?: string
}

function validateApiKey(request: Request, env: Env): boolean {
  if (!env.AUTHICHAIN_API_SECRET) return true // No secret configured = open
  const key = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
  return key === env.AUTHICHAIN_API_SECRET
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  let body: RegisterRequest
  try {
    body = await request.json() as RegisterRequest
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  const { user_id, asset_url, destination_url, prompt, preset_id, mode, fal_request_id } = body

  if (!user_id || !asset_url || !destination_url) {
    return Response.json(
      { error: 'user_id, asset_url, and destination_url are required' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const id = crypto.randomUUID()

  try {
    await env.DB.prepare(
      `INSERT INTO qron_registrations
       (id, user_id, asset_url, destination_url, prompt, preset_id, mode, fal_request_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_mint')`
    )
      .bind(id, user_id, asset_url, destination_url, prompt || null, preset_id || null, mode || 'static', fal_request_id || null)
      .run()
  } catch (err) {
    console.error('D1 registration write error:', err)
    return Response.json(
      { error: 'Failed to register provenance' },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  return Response.json(
    {
      id,
      user_id,
      asset_url,
      destination_url,
      status: 'pending_mint',
      created_at: new Date().toISOString(),
    },
    { status: 201, headers: CORS_HEADERS }
  )
}

async function handleGetRegistration(url: URL, env: Env): Promise<Response> {
  const id = url.searchParams.get('id')
  const userId = url.searchParams.get('user_id')

  if (id) {
    const row = await env.DB.prepare('SELECT * FROM qron_registrations WHERE id = ?')
      .bind(id)
      .first()

    if (!row) {
      return Response.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS })
    }

    return Response.json(row, { status: 200, headers: CORS_HEADERS })
  }

  if (userId) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM qron_registrations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    )
      .bind(userId)
      .all()

    return Response.json({ registrations: results }, { status: 200, headers: CORS_HEADERS })
  }

  return Response.json({ error: 'id or user_id query param required' }, { status: 400, headers: CORS_HEADERS })
}

async function handleMintUpdate(request: Request, env: Env): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  let body: MintUpdateRequest
  try {
    body = await request.json() as MintUpdateRequest
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  const { registration_id, token_id, tx_hash, chain, contract_address } = body

  if (!registration_id || !token_id || !tx_hash) {
    return Response.json(
      { error: 'registration_id, token_id, and tx_hash are required' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // Verify the registration exists
  const existing = await env.DB.prepare('SELECT id, status FROM qron_registrations WHERE id = ?')
    .bind(registration_id)
    .first()

  if (!existing) {
    return Response.json({ error: 'Registration not found' }, { status: 404, headers: CORS_HEADERS })
  }

  // Verify scan validation passed
  const scanResult = await env.DB.prepare(
    'SELECT scannable FROM qron_scan_results WHERE qron_registration_id = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(registration_id)
    .first()

  if (scanResult && !scanResult.scannable) {
    return Response.json(
      { error: 'QR not scannable — cannot mint' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // Update to minted
  await env.DB.prepare(
    `UPDATE qron_registrations
     SET status = 'minted', token_id = ?, tx_hash = ?, chain = ?, contract_address = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(token_id, tx_hash, chain || null, contract_address || null, registration_id)
    .run()

  return Response.json(
    {
      registration_id,
      status: 'minted',
      token_id,
      tx_hash,
    },
    { status: 200, headers: CORS_HEADERS }
  )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)

    // Health
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return Response.json(
        { status: 'ok', worker: 'authichain-qron-provenance', ts: Date.now() },
        { headers: CORS_HEADERS }
      )
    }

    // POST /api/qron-register/mint — update to minted
    if (url.pathname.endsWith('/mint') && request.method === 'POST') {
      return handleMintUpdate(request, env)
    }

    // POST /api/qron-register — register provenance
    if (url.pathname.startsWith('/api/qron-register') && request.method === 'POST') {
      return handleRegister(request, env)
    }

    // GET /api/qron-register?id=... — fetch registration
    if (url.pathname.startsWith('/api/qron-register') && request.method === 'GET') {
      return handleGetRegistration(url, env)
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS })
  },
}
