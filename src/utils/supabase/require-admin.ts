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
 *   const { user } = result;  // fully typed, guaranteed admin
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
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

  // 2. Verify the admin role in the profiles table via the SERVICE ROLE client
  //    so that RLS policies on `profiles` cannot be used to hide the role field
  //    or prevent the lookup.
  //
  //    BUG FIXED: The previous version used `.eq('id', user.id)` which is wrong
  //    — the profiles table uses `user_id` as the FK to auth.users, not `id`.
  //    Using the wrong column caused the role check to silently return no row,
  //    which meant `profile?.role !== 'admin'` always evaluated to true and
  //    every authenticated user got a 403. Switching to `user_id` fixes the
  //    lookup. Using the service-role client ensures RLS cannot hide the row.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { user };
}
