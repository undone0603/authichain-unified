import Link from 'next/link';
import { BRAND_IDS, BRANDS, type BrandId } from '@shared/brands';

/**
 * ProtocolHeader
 * ---------------
 * Unified top navigation bar for all brand landing pages
 * (AuthiChain, QRON, StrainChain, GovChain). Pure server component.
 *
 * Features:
 *  - Brand logo / name with per-brand accent colour
 *  - Ecosystem cross-links to all four brand domains (desktop)
 *  - Pricing + Sign-in CTAs
 *  - Sticky frosted-glass backdrop
 */
export interface ProtocolHeaderProps {
  brandId: BrandId;
}

export function ProtocolHeader({ brandId }: ProtocolHeaderProps) {
  const brand = BRANDS[brandId];
  const accent = brand.accentHex;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 h-16"
      style={{
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
        >
          <span
            className="h-6 w-6 rounded flex items-center justify-center text-black text-[10px] font-black"
            style={{ background: accent }}
          >
            {brand.displayName.charAt(0)}
          </span>
          <span
            className="text-sm font-black uppercase tracking-widest"
            style={{ color: accent }}
          >
            {brand.displayName}
          </span>
        </Link>

        {/* Ecosystem nav — desktop only */}
        <nav
          className="hidden md:flex items-center gap-0.5"
          aria-label="Ecosystem"
        >
          {BRAND_IDS.map((id) => {
            const b = BRANDS[id];
            const isActive = id === brandId;
            return (
              <a
                key={id}
                href={isActive ? '/' : `https://${b.domain}`}
                target={isActive ? undefined : '_blank'}
                rel={isActive ? undefined : 'noopener noreferrer'}
                className={
                  isActive
                    ? 'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider'
                    : 'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300'
                }
                style={isActive ? { color: b.accentHex, background: `${b.accentHex}14` } : undefined}
              >
                {b.displayName}
              </a>
            );
          })}
        </nav>

        {/* CTAs */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/pricing"
            className="hidden sm:inline-flex items-center justify-center rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
            style={{ borderColor: `${accent}50`, color: accent }}
          >
            Pricing
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-px active:translate-y-0"
            style={{ background: accent }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}
