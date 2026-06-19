'use client';

import { useState } from 'react';
import { ChevronRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface LeadCaptureFormProps {
  domain: 'qron' | 'authichain' | 'govchain' | 'strainchain';
  headline?: string;
  subheadline?: string;
  cta?: string;
  className?: string;
}

const DOMAIN_CONFIG = {
  qron: {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    headline: 'Join QRON.space',
    subheadline: 'AI-powered QR codes that convert 3x better',
  },
  authichain: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    headline: 'Get AuthiChain',
    subheadline: 'Digital credentials that matter',
  },
  govchain: {
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    headline: 'Join GovChain.us',
    subheadline: 'DAO governance done right',
  },
  strainchain: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    headline: 'Get StrainChain.io',
    subheadline: 'Full supply chain visibility',
  },
};

export function LeadCaptureForm({
  domain,
  headline,
  subheadline,
  cta = 'Get Started',
  className = '',
}: LeadCaptureFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const config = DOMAIN_CONFIG[domain];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');

    try {
      const res = await fetch('/api/leads/auto-engage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || 'Prospect',
          company: company || undefined,
          domain,
          source: 'landing_form',
          metadata: {
            form_filled_at: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');

      await res.json();
      setStatus('success');
      setMessage(`Welcome! You'll hear from us within 2 hours.`);
      setEmail('');
      setName('');
      setCompany('');

      setTimeout(() => setStatus('idle'), 5000);
    } catch (err) {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border ${config.border} ${config.bg} p-8 max-w-md mx-auto ${className}`}
    >
      <div className="mb-6">
        <h3 className={`text-lg font-black uppercase tracking-tight ${config.color} mb-2`}>
          {headline || config.headline}
        </h3>
        <p className="text-sm text-zinc-400">{subheadline || config.subheadline}</p>
      </div>

      {status === 'success' ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle className={`w-8 h-8 ${config.color}`} />
          <p className="text-sm font-bold text-white text-center">{message}</p>
        </div>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-3 py-6 mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm font-bold text-red-400 text-center">{message}</p>
        </div>
      ) : null}

      {status !== 'success' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold outline-none transition-colors"
              required
            />
          </div>

          <div>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold outline-none transition-colors"
              required
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Company (optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${
              loading
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : `bg-zinc-800 text-white hover:${config.bg} hover:${config.color} hover:border ${config.border}`
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                {cta}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      <p className="text-[10px] text-zinc-600 text-center mt-4 font-bold uppercase tracking-tight">
        🔒 We respect your privacy. No spam, ever.
      </p>
    </div>
  );
}
