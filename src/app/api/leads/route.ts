/**
 * POST /api/leads
 * Saves a guest email lead to Supabase (server-side — no anon key exposure).
 * Body: { email: string; source?: string; metadata?: Record<string, unknown> }
 *
 * Security hardening (2026-06-15):
 *  - Added per-IP rate limiting (10 req/min) via in-memory sliding window
 *  - Added email length cap (254 chars per RFC 5321)
 *  - Strips metadata keys to a safe allow-list to prevent DB pollution
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// OpenNext-Cloudflare bundles nodejs routes in the default server function;
// edge-runtime routes must be separate functions, which this app doesn't use.
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Lightweight in-memory rate limiter (edge-compatible, resets per cold start)
// ---------------------------------------------------------------------------
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;
const ipWindows = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindows.get(ip);
  if (!entry || now > entry.reset) {
    ipWindows.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}

// ---------------------------------------------------------------------------
// Safe metadata keys — prevents arbitrary column injection via metadata field
// ---------------------------------------------------------------------------
const SAFE_METADATA_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'page'];

function sanitizeMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const key of SAFE_METADATA_KEYS) {
    if (key in (raw as Record<string, unknown>)) {
      out[key] = (raw as Record<string, unknown>)[key];
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, source = 'unknown', metadata = {} } = body as {
      email?: unknown;
      source?: unknown;
      metadata?: unknown;
    };

    if (
      !email ||
      typeof email !== 'string' ||
      !email.includes('@') ||
      email.length > 254  // RFC 5321 max email length
    ) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }

    const safeSource = typeof source === 'string' ? source.slice(0, 64) : 'unknown';
    const safeMetadata = sanitizeMetadata(metadata);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.warn('[leads] Supabase env vars not set; lead not persisted.');
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase
      .from('leads')
      .upsert(
        {
          email: email.toLowerCase().trim(),
          source: safeSource,
          metadata: safeMetadata,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('[leads] upsert error:', error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[leads] unexpected error:', err);
    return NextResponse.json({ ok: true }); // never expose internals
  }
}
