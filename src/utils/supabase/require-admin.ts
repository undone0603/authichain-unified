/**
 * requireAdmin()
 * 
 * Shared server-side helper used by every /api/admin/* route.
 * Returns the verified user object when the request is from an authenticated
 * admin, or a NextResponse(401/403) to return directly when it is not.
 *
 * Usage:
 *   const result = await requireAdmin();
 *   if (result instanceof NextResponse) return result;
 *   const { user } = result;   // fully typed, guaranteed admin
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { User } from '@supabase/supabase-js';

type AdminOk = { user: User };
type AdminFail = NextResponse;

export async function requireAdmin(): Promise<AdminOk | AdminFail> {
  const supabase = await createClient();

  // 1. Verify the session cookie — getUser() re-validates with the Auth server,
  //    so a tampered or expired JWT is rejected even if the cookie exists.
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify the admin role in the profiles table.
  //    Adjust the column/value if your schema uses a different field.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { user };
}
