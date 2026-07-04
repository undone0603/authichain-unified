'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'sticky_cta_dismissed';

/**
 * Sticky bottom conversion bar. Appears after 3 seconds OR once the visitor
 * scrolls past 50% of the page — whichever comes first. Dismissible, and the
 * dismissed state persists for the session via sessionStorage.
 */
export function StickyConversionBar({
  accent = '#f59e0b',
  href = '/login',
  label = 'Start free',
  subtext = 'No credit card required',
}: {
  accent?: string;
  href?: string;
  label?: string;
  subtext?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until mounted

  useEffect(() => {
    let alreadyDismissed = false;
    try {
      alreadyDismissed = sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {}
    setDismissed(alreadyDismissed);
    if (alreadyDismissed) return;

    const reveal = () => setVisible(true);

    const timer = setTimeout(reveal, 3000);

    const onScroll = () => {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      if (window.scrollY / scrollable > 0.5) reveal();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  }, []);

  if (dismissed || !visible) return null;

  return (
    <div
      role="region"
      aria-label="Sign-up call to action"
      className="fixed inset-x-0 bottom-0 z-40 animate-slide-up border-t border-zinc-800 bg-black/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className="hidden h-2 w-2 shrink-0 animate-pulse rounded-full sm:inline-block"
            style={{ backgroundColor: accent }}
          />
          <p className="text-[11px] font-black uppercase leading-tight tracking-widest text-white sm:text-xs">
            {label}
            <span className="ml-2 font-bold text-zinc-500">— {subtext}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition-transform hover:translate-y-[-1px] sm:text-xs"
            style={{ backgroundColor: accent }}
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
