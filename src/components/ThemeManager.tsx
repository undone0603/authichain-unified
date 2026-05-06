'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * THEME MANAGER
 * Dynamically applies site-wide themes based on the active route.
 * 
 * 1. Patriotic (USA/GovChain): /ftc-shield, /governance, /partners
 * 2. Agricultural (StrainChain): /strainchain (or specific industrial paths)
 * 3. Artistic (QRON.space): /, /gallery, /dashboard
 * 4. AuthiChain (Gold): /admin, /legal, /login
 */
export function ThemeManager() {
  const pathname = usePathname();

  useEffect(() => {
    // Remove all possible theme classes
    document.body.classList.remove('theme-patriotic', 'theme-agricultural', 'theme-artistic');

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
      pathname === '/' || 
      pathname.includes('gallery') || 
      pathname.includes('reveal')
    ) {
      document.body.classList.add('theme-artistic');
      return;
    }

    // 4. Default Theme (AuthiChain Gold)
    // No class added, uses :root variables
  }, [pathname]);

  return null;
}
