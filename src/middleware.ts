import { NextRequest, NextResponse } from 'next/server';
import { BRAND_BASE } from '@/lib/brand-domains';

/**
 * Middleware runs at the edge (before any page/route handler).
 *
 * Responsibilities:
 *  1. Canonical-host redirect  — www.qron.space → qron.space  (301)
 *  2. Alias-domain redirect    — qron.io        → qron.space  (301)
 *  3. Edge auth gate           — /admin/* and /dashboard/* require a
 *     Supabase session cookie. If absent, redirect to /login with a
 *     `next` param so the user is returned after signing in.
 *
 * Note: The edge check is a fast first line of defence (cookie presence).
 * Full session validity + role enforcement is re-checked in:
 *   - Server layouts  (src/app/admin/layout.tsx, src/app/dashboard/layout.tsx)
 *   - API helpers     (src/utils/supabase/require-admin.ts)
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const { pathname } = req.nextUrl;

  // ── 1 & 2. Canonical / alias redirect ─────────────────────────────────────
  const canonical = BRAND_BASE[host];
  if (canonical && !canonical.includes(host)) {
    const url = req.nextUrl.clone();
    url.host = new URL(canonical).host;
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  // ── 3. Edge auth gate ─────────────────────────────────────────────────────
  // Protected prefixes: all page routes under /admin and /dashboard.
  // API routes under /api/admin/* are independently hardened but we also
  // gate them here so unauthenticated fetch() calls get a fast 401 at edge
  // rather than hitting the Node runtime.
  const isProtected =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/admin');

  if (isProtected) {
    // Supabase stores the session in a cookie whose name starts with
    // 'sb-' and ends with '-auth-token'. We check for its presence here;
    // actual JWT validation happens in the server layout / route handler.
    const hasSession = [...req.cookies.getAll()].some(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );

    if (!hasSession) {
      // For API routes return 401 JSON — don't redirect XHR requests.
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // For page routes redirect to login.
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|media/).*)'],
};
