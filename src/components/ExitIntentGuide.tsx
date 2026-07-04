'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, FileCheck, X } from 'lucide-react';

const SHOWN_KEY = 'dpp_guide_shown';

/**
 * Exit-intent email capture. When the pointer leaves the top of the viewport,
 * a modal offers the free "EU DPP readiness guide" in exchange for an email.
 * Fires at most once per session and POSTs to /api/lead-capture.
 */
export function ExitIntentGuide({
  accent = '#f59e0b',
  productInterest = 'authichain',
}: {
  accent?: string;
  productInterest?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!mounted) return;

    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return;
    } catch {}

    const markShown = () => {
      try {
        sessionStorage.setItem(SHOWN_KEY, '1');
      } catch {}
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setVisible(true);
        markShown();
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };

    // Only arm exit-intent after a short delay so it never fires on load.
    const arm = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 6000);

    return () => {
      clearTimeout(arm);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'exit_intent_dpp_guide',
          page_url: window.location.pathname,
          product_interest: productInterest,
          utm_source: params.get('utm_source') || '',
          utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
        }),
      });
    } catch {
      // swallow — still confirm to the visitor
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-6 text-center">
            <div
              className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent}1a`, color: accent }}
            >
              <FileCheck className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white">
              Check your inbox
            </h3>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              Your EU DPP readiness guide is on its way.
            </p>
            <button
              onClick={dismiss}
              className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 transition-colors hover:text-white"
            >
              [ Close ]
            </button>
          </div>
        ) : (
          <>
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              style={{ borderColor: `${accent}33`, color: accent, backgroundColor: `${accent}0d` }}
            >
              <FileCheck className="h-3 w-3" />
              Free Guide
            </div>
            <h3 className="text-2xl font-black uppercase leading-none tracking-tighter text-white">
              Get our <span style={{ color: accent }}>EU DPP</span>
              <br /> readiness guide
            </h3>
            <p className="mb-6 mt-3 text-xs font-bold uppercase leading-relaxed tracking-tight text-zinc-500">
              The July 19, 2026 registry launch is coming. Get the checklist to make every product passport-ready — free.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                className="protocol-input w-full px-4 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[11px] font-black uppercase tracking-widest text-black transition-transform hover:translate-y-[-1px] disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {loading ? 'Sending…' : 'Send Me the Guide'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
            <p className="mt-5 text-center text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">
              No spam · Unsubscribe anytime
            </p>
          </>
        )}
      </div>
    </div>
  );
}
