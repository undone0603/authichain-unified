'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError][layout]', error.message, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', gap: '1.5rem' }}>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#ef4444' }}>500</div>
          <p style={{ color: '#71717a', fontSize: '0.875rem', maxWidth: '24rem' }}>
            Something went wrong. Our team has been notified.
          </p>
          {error.digest && (
            <p style={{ color: '#3f3f46', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1.5rem', border: '1px solid #3f3f46', borderRadius: '0.5rem', background: 'transparent', color: '#fff', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
