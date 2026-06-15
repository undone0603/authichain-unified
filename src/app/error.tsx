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
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-5xl font-black text-red-500">Error</div>
        <p className="text-zinc-400 text-sm">
          Something went wrong. Our team has been notified.
        </p>
        {error.digest && (
          <p className="text-zinc-600 font-mono text-xs">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2 border border-zinc-700 rounded-lg text-xs font-black uppercase tracking-widest hover:border-zinc-500 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
