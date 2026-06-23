'use client';

import { useState, useCallback } from 'react';

/**
 * useTryForFree — kicks off the card-required Stripe free trial that replaced
 * the old free-generations grant. Redirects to Stripe Checkout on success, or
 * to /login if the user isn't signed in (a trial must attach to an account).
 */
export function useTryForFree() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startTrial = useCallback(async (email?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      });

      if (res.status === 401) {
        window.location.assign('/login?next=trial');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error || 'Could not start your free trial');
    } catch {
      setError('Could not start your free trial');
    } finally {
      setLoading(false);
    }
  }, []);

  return { startTrial, loading, error };
}
