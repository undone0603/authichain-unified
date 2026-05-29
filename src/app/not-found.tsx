import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Page Not Found | AuthiChain',
  description: 'This page does not exist.',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">404</p>
      <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">
        Page Not Found
      </h1>
      <p className="text-zinc-500 text-sm max-w-xs mb-10">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-6 py-3 bg-yellow-400 text-black text-xs font-black uppercase tracking-widest rounded-lg hover:bg-yellow-300 transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/docs"
          className="px-6 py-3 border border-zinc-700 text-xs font-black uppercase tracking-widest rounded-lg hover:border-zinc-500 transition-colors"
        >
          Docs
        </Link>
      </div>
    </div>
  );
}
