'use client';

import React, { useState, useEffect, useCallback, startTransition } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';

import { getBrandFromHost, BRANDS } from '@/lib/brand-config';

export function LeadCapturePopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  const brand = mounted && typeof window !== 'undefined' 
    ? getBrandFromHost(window.location.host) 
    : BRANDS.qron;

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem('qron_lead_dismissed', '1');
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      if (sessionStorage.getItem('qron_lead_dismissed')) return;
      if (localStorage.getItem('qron_lead_captured')) return;
    } catch {}

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) setVisible(true);
    };

    const handleScroll = () => {
      const scrollPercent =
        window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (scrollPercent > 0.5) setVisible(true);
    };

    const timer = setTimeout(() => setVisible(true), 45000);

    const activateTimer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('scroll', handleScroll, { passive: true });
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(activateTimer);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);
      await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'popup',
          page_url: window.location.pathname,
          product_interest: 'qron',
          utm_source: params.get('utm_source') || '',
          utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
        }),
      });
      setSubmitted(true);
      try {
        localStorage.setItem('qron_lead_captured', '1');
      } catch {}
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="protocol-card relative w-full max-w-md mx-4 p-8 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-gold/10">
              <Sparkles className="h-8 w-8 text-gold" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white uppercase tracking-tighter">
              Welcome to {brand.name}!
            </h3>
            <p className="text-zinc-400 text-sm uppercase tracking-tight">
              Your ecosystem access is ready. Join the protocol to get started.
            </p>
            <a href="/login" className="btn-gold inline-block mt-6 px-10 py-3 font-black uppercase tracking-widest text-[10px]">
              Enter {brand.name}
            </a>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 bg-gold/10 text-gold border border-gold/20">
              <Sparkles className="h-3 w-3" />
              {brand.name} Access
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white uppercase tracking-tighter leading-none">
              Join the <br /> <span className="gold-text">{brand.name}</span> Protocol
            </h3>
            <p className="mb-6 text-zinc-500 text-xs font-bold uppercase tracking-tight leading-relaxed">
              {brand.tagline}. Sign up for free industrial-scale authentication and creative tools.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                placeholder="Enterprise Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="protocol-input w-full px-4 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full flex items-center justify-center gap-2 py-4 font-black uppercase tracking-widest text-[10px]"
              >
                {loading ? 'Initializing...' : `Get ${brand.name} Access`}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
            <p className="text-[9px] mt-6 text-center text-zinc-600 uppercase tracking-[0.2em] font-black">
              AuthiChain Protocol &middot; Secure &middot; Verifiable
            </p>
          </>
        )}
      </div>
    </div>
  );
}
