'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { ProtocolHeader } from './ProtocolHeader';
import { resolveBrand } from '@shared/brands';

/**
 * SiteNav
 * Client wrapper that renders ProtocolHeader on all public-facing pages.
 * Hides navigation on dashboard, auth, and API routes.
 */

// Prefixes that have their own navigation (dashboard sidebar, auth forms, etc.)
const HIDDEN_PREFIXES = [
  '/dashboard',
  '/auth',
  '/login',
  '/signup',
  '/register',
  '/api',
  '/admin',
];

export function SiteNav() {
  const pathname = usePathname();

  // Determine brand from current hostname
  const brandId = useMemo(() => {
    if (typeof window === 'undefined') return 'authichain' as const;
    return resolveBrand(window.location.hostname);
  }, []);

  // Skip rendering on app/auth pages
  const isHidden = HIDDEN_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isHidden) return null;

  return <ProtocolHeader brandId={brandId} />;
}
