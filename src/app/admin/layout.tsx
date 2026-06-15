/**
 * Admin layout — server component auth guard.
 * Checks Supabase session server-side and redirects to /login if not authenticated.
 * Also enforces that the user has the 'admin' role in their profile.
 */
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

async function getAdminSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // read-only in Server Components
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check admin role — adjust column name to match your profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return null;
  return user;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getAdminSession();

  if (!user) {
    redirect('/login?next=/admin');
  }

  return <>{children}</>;
}
