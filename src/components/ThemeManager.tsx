'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

/**
 * THEME MANAGER
 * Dynamically applies site-wide themes based on the active route.
 * 
 * 1. Patriotic (USA/GovChain): /ftc-shield, /governance, /partners
 * 2. Agricultural (StrainChain): /strainchain (or specific industrial paths)
 * 3. Artistic (QRON.space): /, /gallery, /dashboard
 * 4. AuthiChain (Gold): /admin, /legal, /login
 */
export function ThemeManager({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Remove all possible theme classes
    document.body.classList.remove('theme-patriotic', 'theme-agricultural', 'theme-artistic');

    // 0. On the multi-brand homepage, theme by host so each domain
    // (authichain.com / qron.space / strainchain.io / govchain.us) gets its
    // own palette. The homepage renders a per-brand experience (see
    // src/app/page.tsx), so route-based matching below would mis-theme it.
    if (pathname === '/') {
      const host = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
      if (host.includes('govchain')) document.body.classList.add('theme-patriotic');
      else if (host.includes('strainchain')) document.body.classList.add('theme-agricultural');
      else if (host.includes('qron')) document.body.classList.add('theme-artistic');
      // authichain.com → default gold (:root), no class added
      return;
    }

    // 1. Patriotic Theme
    if (
      pathname.includes('ftc-shield') ||
      pathname.includes('governance') ||
      pathname.includes('partners') ||
      pathname.includes('govchain')
    ) {
      document.body.classList.add('theme-patriotic');
      return;
    }

    // 2. Agricultural Theme
    if (
      pathname.includes('strainchain') ||
      pathname.includes('industrial') ||
      pathname.includes('dpp')
    ) {
      document.body.classList.add('theme-agricultural');
      return;
    }

    // 3. Artistic Theme
    if (
      pathname.includes('gallery') ||
      pathname.includes('reveal')
    ) {
      document.body.classList.add('theme-artistic');
      return;
    }

    // 4. Default Theme (AuthiChain Gold)
    // No class added, uses :root variables
  }, [pathname]);

  return children;
}
