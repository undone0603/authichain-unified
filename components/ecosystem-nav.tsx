// components/ecosystem-nav.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const ECOSYSTEM = [
  {
    name: 'AuthiChain',
    url:   'https://authichain.com',
    badge: 'bg-accent/10 text-accent border-accent/30',
    dot:   'bg-accent',
    desc:  'Product Authentication',
  },
  {
    name: 'QRON',
    url:   process.env.NEXT_PUBLIC_QRON_URL ?? 'https://qron.io',
    badge: 'bg-qron/10 text-qron border-qron/30',
    dot:   'bg-qron',
    desc:  'AI QR Art Platform',
  },
  {
    name: 'StrainChain',
    url:   process.env.NEXT_PUBLIC_STRAINCHAIN_URL ?? 'https://strainchain.io',
    badge: 'bg-strain/10 text-strain border-strain/30',
    dot:   'bg-strain',
    desc:  'Cannabis Supply Chain',
  },
  {
    name: 'GovChain',
    url:   process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us',
    badge: 'bg-govchain/10 text-govchain border-govchain/30',
    dot:   'bg-govchain',
    desc:  'Government Provenance',
  },
] as const;

export function EcosystemNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-primary/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center glow-accent">
              <span className="text-accent font-mono text-sm font-bold">A</span>
            </div>
            <span className="font-semibold text-white hidden sm:block">AuthiChain</span>
          </Link>

          {/* Ecosystem Links — desktop */}
          <div className="hidden lg:flex items-center gap-2">
            {ECOSYSTEM.map((item) => (
              <a
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`ecosystem-badge ${item.badge} hover:opacity-80 transition-opacity cursor-pointer`}
                title={item.desc}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${item.dot} shrink-0`} />
                {item.name}
              </a>
            ))}
          </div>

          {/* Right CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={`${process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us'}/verify`}
              className="hidden sm:inline-flex btn-govchain text-sm py-2 px-4"
            >
              Verify Product
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us'}/dashboard`}
              className="btn-primary text-sm py-2 px-4"
            >
              Dashboard
            </a>

            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-2 rounded-md text-muted hover:text-white transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-border py-4 space-y-2 animate-fade-in">
            {ECOSYSTEM.map((item) => (
              <a
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface transition-colors"
              >
                <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                <span className="font-medium text-white">{item.name}</span>
                <span className="text-xs text-muted ml-auto">{item.desc}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
