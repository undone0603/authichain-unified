'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, CheckCircle } from 'lucide-react';

export default function AffiliateApplyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleJoin() {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/affiliate/join', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to join');
        setStatus('error');
        return;
      }
      router.push('/dashboard/affiliate?joined=1');
    } catch {
      setError('Network error — please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold uppercase tracking-widest mb-8">
          <Zap className="w-3 h-3" />
          QRON Affiliate Program
        </div>

        <h1 className="text-4xl font-black mb-4 tracking-tight">
          Join & Start Earning
        </h1>
        <p className="text-zinc-400 mb-8 leading-relaxed">
          Instant approval. Get your unique referral link, track conversions in
          real time, and receive monthly payouts via Stripe.
        </p>

        <ul className="space-y-3 mb-10">
          {[
            '20% recurring commission on every sale',
            'Real-time dashboard with clicks & earnings',
            'Monthly Stripe payouts — no minimums',
            'Escalates to 30% at 51+ sales/mo',
          ].map((perk) => (
            <li key={perk} className="flex items-center gap-3 text-sm text-zinc-300">
              <CheckCircle className="w-4 h-4 text-gold shrink-0" />
              {perk}
            </li>
          ))}
        </ul>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-950 border border-red-800 text-red-300 text-sm">
            {error}
            {error.toLowerCase().includes('unauthorized') && (
              <span>
                {' '}—{' '}
                <a href="/login" className="underline">
                  sign in first
                </a>
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={status === 'loading'}
          className="w-full btn-gold py-4 text-base font-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Joining…' : 'Activate My Affiliate Account →'}
        </button>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Already joined?{' '}
          <a href="/dashboard/affiliate" className="text-gold hover:underline">
            Go to your dashboard
          </a>
        </p>
      </div>
    </div>
  );
}
