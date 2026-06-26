'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function BookForm() {
  const params = useSearchParams();
  const prospectId = params.get('prospect_id') ?? '';
  const campaign   = params.get('utm_campaign') ?? '';

  const [form, setForm] = useState({
    name:      '',
    email:     '',
    company:   '',
    message:   '',
    interest:  campaign.includes('govchain') ? 'GovChain (CMMC / Gov Contracting)'
             : campaign.includes('strainchain') ? 'StrainChain (Cannabis Supply Chain)'
             : campaign.includes('qron') ? 'QRON (AI QR Codes)'
             : '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, prospect_id: prospectId, utm_campaign: campaign }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-6">✅</div>
        <h2 className="text-3xl font-black mb-4">You're on the calendar.</h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          We'll reach out within a few hours to confirm a time. In the meantime,
          explore the demo at <a href="https://app.authichain.com/demo" className="text-yellow-500 underline">app.authichain.com/demo</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Name *</label>
          <input
            type="text" required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Work Email *</label>
          <input
            type="email" required
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
            placeholder="you@company.com"
          />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Company *</label>
          <input
            type="text" required
            value={form.company}
            onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
            placeholder="Your organization"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Interested In</label>
          <select
            value={form.interest}
            onChange={e => setForm(f => ({ ...f, interest: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
          >
            <option value="">Select a product...</option>
            <option>GovChain (CMMC / Gov Contracting)</option>
            <option>AuthiChain (Product Authentication)</option>
            <option>StrainChain (Cannabis Supply Chain)</option>
            <option>QRON (AI QR Codes)</option>
            <option>Enterprise / Custom</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">What would you like to discuss?</label>
        <textarea
          rows={4}
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500 resize-none"
          placeholder="Tell us what you're trying to solve..."
        />
      </div>
      {status === 'error' && (
        <p className="text-red-400 text-sm">Something went wrong — email us directly at <a href="mailto:hello@authichain.com" className="underline">hello@authichain.com</a></p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-yellow-500 text-black font-black uppercase tracking-widest py-4 rounded hover:bg-yellow-400 transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Booking...' : 'Request a Demo Call →'}
      </button>
      <p className="text-center text-zinc-500 text-xs">We respond within 4 business hours. No spam, ever.</p>
    </form>
  );
}

export default function BookPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="pt-28 pb-12 px-6 text-center">
        <div className="inline-block bg-yellow-500/10 text-yellow-400 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
          20-Minute Discovery Call
        </div>
        <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">
          Let's talk about<br />
          <span className="text-yellow-500">your use case.</span>
        </h1>
        <p className="text-zinc-400 max-w-xl mx-auto">
          GovChain · AuthiChain · StrainChain · QRON — one platform, built for compliance and authentication at scale.
        </p>
      </section>
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <Suspense fallback={<div className="animate-pulse h-96 bg-zinc-900 rounded" />}>
          <BookForm />
        </Suspense>
      </section>
    </div>
  );
}
