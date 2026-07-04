'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';

const ACCENT = '#3B82F6';

export function GuideForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          company,
          source: 'eu-dpp-guide',
          product_interest: 'eu-dpp',
          page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      if (!res.ok) throw new Error('request failed');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="protocol-card p-8 text-center">
        <CheckCircle className="mx-auto mb-4 h-10 w-10" style={{ color: ACCENT }} />
        <h3 className="text-lg font-black uppercase tracking-tight mb-2">Check Your Inbox</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Your EU Digital Product Passport Implementation Guide is on its way.
          While you wait, explore how AuthiChain issues registry-ready passports
          in under a day.
        </p>
        <a
          href="/eu-dpp"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-xs font-black uppercase tracking-widest text-white"
          style={{ backgroundColor: ACCENT }}
        >
          See EU DPP Solution
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="protocol-card p-8">
      <h3 className="text-lg font-black uppercase tracking-tight mb-1">Get the Free Guide</h3>
      <p className="text-[13px] text-zinc-400 mb-6 leading-relaxed">
        Instant download. The complete 2026 EU DPP implementation playbook —
        timeline, product scope, data model, and cost breakdown.
      </p>
      <div className="space-y-3">
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company (optional)"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-transform hover:translate-y-[-1px] disabled:opacity-60"
          style={{ backgroundColor: ACCENT }}
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Download the Guide
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        {status === 'error' && (
          <p className="text-[12px] text-red-400">
            Something went wrong. Please try again or email support@authichain.com.
          </p>
        )}
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          No spam. Unsubscribe anytime. We use your email only to send the guide
          and occasional EU DPP updates.
        </p>
      </div>
    </form>
  );
}
