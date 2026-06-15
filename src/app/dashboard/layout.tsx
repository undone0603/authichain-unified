/**
 * Dashboard layout — server component auth guard.
 * Checks Supabase session server-side and redirects to /login if not authenticated.
 */
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

async function getSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSession();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  return <>{children}</>;
}
