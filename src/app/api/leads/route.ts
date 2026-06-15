/**
 * POST /api/leads
 * Saves a guest email lead to Supabase (server-side — no anon key exposure).
 * Body: { email: string; source?: string; metadata?: Record<string, unknown> }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { email, source = 'unknown', metadata = {} } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      // Gracefully degrade — never crash the UX
      console.warn('[leads] Supabase env vars not set; lead not persisted.');
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase
      .from('leads')
      .upsert(
        { email: email.toLowerCase().trim(), source, metadata, updated_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('[leads] upsert error:', error.message);
      // Still 200 — don't fail the guest UX over a DB write
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[leads] unexpected error:', err);
    return NextResponse.json({ ok: true }); // never expose internals
  }
}
