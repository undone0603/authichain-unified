'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);

  return (
    <div className="min-h-screen protocol-bg text-white flex flex-col items-center justify-center gap-6 px-4">
      <p className="text-5xl">&#x26A0;&#xFE0F;</p>
      <h2 className="text-2xl font-black uppercase tracking-tighter gold-text">
        Something went wrong
      </h2>
      {error.digest && (
        <p className="text-xs text-zinc-600 font-mono">ref: {error.digest}</p>
      )}
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="btn-gold px-6 py-2 rounded-xl text-sm font-bold"
        >
          Try again
        </button>
        <Link
          href="/"
          className="btn-outline-gold px-6 py-2 rounded-xl text-sm font-bold"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
