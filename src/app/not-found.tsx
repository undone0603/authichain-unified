import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen protocol-bg text-white flex flex-col items-center justify-center gap-6 px-4 text-center">
      <p
        className="text-8xl font-black gold-text"
        style={{ lineHeight: 1, letterSpacing: '-0.04em' }}
      >
        404
      </p>
      <h1 className="text-2xl font-black uppercase tracking-tighter">
        Page not found
      </h1>
      <p className="text-sm text-zinc-500 max-w-xs">
        This QRON has drifted off-chain. Head back to the studio.
      </p>
      <Link
        href="/"
        className="btn-gold px-8 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2"
      >
        Back to QRON Studio
      </Link>
    </div>
  );
}
