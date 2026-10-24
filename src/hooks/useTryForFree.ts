'use client';

import { useState, useCallback } from 'react';

/**
 * useTryForFree — the card trial is retired. Start Free goes to the public
 * free plan (five generations). This hook does not open a Checkout Session.
 */
export function useTryForFree() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startTrial = useCallback(async (_email?: string) => {
    setLoading(true);
    setError(null);
    window.location.assign("https://qron.space/generate");
  }, []);

  return { startTrial, loading, error };
}
