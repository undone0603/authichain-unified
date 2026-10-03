import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

function slugFromEmail(email: string, userId: string) {
  const local = email.split('@')[0] ?? 'acct'
  const base = local.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
  return `${base || 'acct'}-${userId.slice(0, 6)}`
}

async function mintKey() {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  const apiKey = `qron_${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
  const keyHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return { apiKey, keyPrefix: apiKey.slice(0, 12), keyHash }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, slug, brand, plan, status, stripe_customer_id, created_at')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to load account' }, { status: 500 })
  return NextResponse.json({ account: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { name?: string; brand?: string }
  const brand = ['authichain', 'qron', 'govchain', 'strainchain'].includes(body.brand ?? '')
    ? body.brand!
    : 'authichain'

  const { data: existing } = await supabase
    .from('accounts')
    .select('id, name, slug, brand, plan, status')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ account: existing, created: false })

  const name = (body.name ?? user.email.split('@')[0]).slice(0, 80)
  const { data: account, error } = await supabase
    .from('accounts')
    .insert({
      name,
      slug: slugFromEmail(user.email, user.id),
      brand,
      owner_user_id: user.id,
      plan: 'free',
      status: 'active',
    })
    .select('id, name, slug, brand, plan, status')
    .single()

  if (error || !account) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  const { apiKey, keyPrefix, keyHash } = await mintKey()
  const { error: keyError } = await supabase.from('api_keys').insert({
    user_id: user.id,
    name: 'Default',
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes: ['read', 'write', 'generate'],
    is_active: true,
  })

  return NextResponse.json({
    account,
    apiKey: keyError ? null : apiKey,
    keyError: keyError ? 'Account created. Key mint failed; retry POST /api/keys.' : null,
    created: true,
  })
}
