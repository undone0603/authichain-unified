'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    fd.get('name'),
          email:   fd.get('email'),
          company: fd.get('company') || 'Not provided',
          message: fd.get('message'),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Submission failed');
      }
      setStatus('done');
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong. Please email us directly.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-blue-400 mx-auto mb-6" />
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">Message Sent</h1>
          <p className="text-zinc-400 mb-8">
            We'll respond within 24 hours. EU DPP demo requests get priority scheduling.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-8 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <section className="pt-32 pb-20 px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">
          GET IN <span className="gold-text">TOUCH</span>
        </h1>
        <p className="max-w-2xl mx-auto text-zinc-500 text-lg font-medium uppercase tracking-widest">
          Enterprise inquiries. EU DPP demos. Partnerships.
          <br />
          We respond within 24 hours.
        </p>
      </section>

      {/* Contact Form */}
      <section className="max-w-2xl mx-auto px-6 pb-32">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Company <span className="text-zinc-700 normal-case font-medium">(optional)</span>
            </label>
            <input
              type="text"
              name="company"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              placeholder="Your organization"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Message
            </label>
            <textarea
              name="message"
              required
              rows={6}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Tell us about your project or inquiry..."
            />
          </div>

          {status === 'error' && (
            <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded inline-flex items-center justify-center gap-2 transition-colors"
          >
            {status === 'sending' ? 'Sending…' : 'Send Message'}
            {status !== 'sending' && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Alternative Contact */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          <div className="border border-zinc-800 rounded p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Email</div>
            <a href="mailto:authichain@gmail.com" className="text-blue-400 hover:text-blue-300 text-sm">
              authichain@gmail.com
            </a>
          </div>
          <div className="border border-zinc-800 rounded p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">EU DPP</div>
            <a href="mailto:eu-dpp@govchain.us" className="text-blue-400 hover:text-blue-300 text-sm">
              eu-dpp@govchain.us
            </a>
          </div>
          <div className="border border-zinc-800 rounded p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Enterprise</div>
            <a href="mailto:enterprise@authichain.com" className="text-blue-400 hover:text-blue-300 text-sm">
              enterprise@authichain.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
