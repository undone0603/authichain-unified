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
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: '#050505',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '3rem' }}>&#x26A0;&#xFE0F;</p>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: '#c9a227',
          }}
        >
          Critical error
        </h1>
        {error.digest && (
          <p style={{ fontSize: '0.7rem', color: '#444', fontFamily: 'monospace' }}>
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            background: '#c9a227',
            color: '#000',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.75rem 2rem',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
