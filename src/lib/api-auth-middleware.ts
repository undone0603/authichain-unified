/**
 * @file api-auth-middleware.ts
 * Shared authentication helpers for Next.js API route handlers.
 *
 * Usage (API key routes):
 *   const userId = await requireApiKey(req);
 *   if (userId instanceof NextResponse) return userId; // 401
 *
 * Usage (session routes):
 *   const user = await requireSession(req);
 *   if (user instanceof NextResponse) return user; // 401
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth-api';
import { createClient } from '@/utils/supabase/server';

/**
 * Extracts and verifies the Bearer API key from the Authorization header.
 * Returns the userId string on success, or a 401 NextResponse on failure.
 */
export async function requireApiKey(
  req: NextRequest
): Promise<string | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return NextResponse.json(
      { error: 'Missing Authorization header. Expected: Bearer <api_key>' },
      { status: 401 }
    );
  }

  const userId = await verifyApiKey(token);
  if (!userId) {
    return NextResponse.json(
      { error: 'Invalid or revoked API key' },
      { status: 401 }
    );
  }

  return userId;
}

/**
 * Verifies the Supabase session cookie.
 * Returns the Supabase User object on success, or a 401 NextResponse on failure.
 */
export async function requireSession(
  _req: NextRequest
): Promise<{ id: string; email?: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  return { id: user.id, email: user.email };
}

/**
 * Accepts either a valid session OR a valid API key.
 * Returns { userId, method } on success, or a 401 NextResponse.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ userId: string; method: 'session' | 'apikey' } | NextResponse> {
  // Try API key first (stateless, faster)
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const result = await requireApiKey(req);
    if (result instanceof NextResponse) return result;
    return { userId: result, method: 'apikey' };
  }

  // Fall back to session
  const result = await requireSession(req);
  if (result instanceof NextResponse) return result;
  return { userId: result.id, method: 'session' };
}
