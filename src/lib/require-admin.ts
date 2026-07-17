import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Gate a Next.js API route handler to the site owner. There is no `role`
 * column on `profiles` (Supabase Auth users are all plain customers of the
 * QRON/AuthiChain platform) — ADMIN_EMAIL is the existing convention used
 * elsewhere (daily maintenance report, executive report) for identifying the
 * owner, so it's reused here rather than requiring a schema migration.
 *
 * Returns the authenticated user on success, or a NextResponse to return
 * immediately (401 if not logged in, 403 if logged in but not the admin).
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<{ user: { id: string; email?: string } } | NextResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { user };
}
