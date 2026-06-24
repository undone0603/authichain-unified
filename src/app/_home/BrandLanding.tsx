import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { BRANDS, type BrandId } from '@shared/brands';

export interface LandingFeature {
  icon: ReactNode;
  title: string;
  desc: string;
}

export interface LandingStat {
  value: string;
  label: string;
}

export interface LandingCta {
  label: string;
  href: string;
}

export interface BrandLandingProps {
  brandId: BrandId;
  /** Optional body theme class that sets --accent (e.g. 'theme-agricultural'). */
  themeClass?: string;
  /** Short eyebrow above the hero headline. */
  eyebrow: string;
  /** Override the hero headline (defaults to the brand tagline). */
  headline?: string;
  /** Override the hero sub-copy (defaults to the brand description). */
  subhead?: string;
  /** Vertical-specific value props. */
  features: LandingFeature[];
  /** Optional headline stat strip. */
  stats?: LandingStat[];
  /** Closing pitch above the pricing CTA. */
  closingLine: string;
  /** Primary hero CTA (defaults to the brand's ctaLabel → ctaHref). */
  primaryCta?: LandingCta;
  /** Secondary hero CTA (defaults to View Pricing → /pricing). */
  secondaryCta?: LandingCta;
}

/**
 * Shared, conversion-focused landing shell for the non-QRON brands
 * (AuthiChain / StrainChain / GovChain). Server component — no client state.
 * Brand copy + CTA destinations come from the canonical `shared/brands.ts`;
 * the accent color is driven by each brand's `accentHex` so every domain
 * presents on-brand without depending on route-based theme classes.
 */
export function BrandLanding({
  brandId,
  themeClass,
  eyebrow,
  headline,
  subhead,
  features,
  stats,
  closingLine,
  primaryCta,
  secondaryCta,
}: BrandLandingProps) {
  const brand = BRANDS[brandId];
  const accent = brand.accentHex;
  const primary = primaryCta ?? { label: brand.ctaLabel, href: brand.ctaHref };
  const secondary = secondaryCta ?? { label: 'View Pricing', href: '/pricing' };

  return (
    <div className={`min-h-screen bg-black text-white ${themeClass ?? ''}`}>
      {/* Hero */}
      <section className="relative px-6 pt-32 pb-24 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-30"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${accent}33 0%, transparent 60%)`,
          }}
        />
        <div className="relative max-w-4xl mx-auto">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] mb-8"
            style={{ borderColor: `${accent}40`, color: accent, backgroundColor: `${accent}0d` }}
          >
            {brand.displayName} · {eyebrow}
          </span>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-[0.95]">
            {headline ?? brand.tagline}
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-400 text-base md:text-lg font-medium leading-relaxed mb-10">
            {subhead ?? brand.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={primary.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-black transition-transform hover:translate-y-[-2px]"
              style={{ backgroundColor: accent }}
            >
              {primary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={secondary.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors"
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      {stats && stats.length > 0 && (
        <section className="border-y border-zinc-900 bg-zinc-950/40">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-900">
            {stats.map((s) => (
              <div key={s.label} className="px-6 py-8 text-center">
                <div className="text-3xl font-black" style={{ color: accent }}>
                  {s.value}
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="protocol-card p-8">
              <div
                className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}1a`, color: accent }}
              >
                {f.icon}
              </div>
              <h3 className="text-sm font-black uppercase tracking-tight mb-3">{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA → pricing (revenue) */}
      <section className="border-t border-zinc-900 px-6 py-24 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl md:text-4xl font-black uppercase tracking-tighter mb-6">
          {closingLine}
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-sm font-medium uppercase tracking-widest text-zinc-500">
          Start free. Every artifact is cryptographically signed on-chain.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-black transition-transform hover:translate-y-[-2px]"
            style={{ backgroundColor: accent }}
          >
            See Plans &amp; Pricing
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors"
          >
            Talk to Sales
          </Link>
        </div>
        <ul className="mx-auto mt-12 flex max-w-2xl flex-wrap justify-center gap-x-8 gap-y-3">
          {['Polygon-anchored', 'Stripe-secured checkout', 'No setup fees'].map((t) => (
            <li key={t} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              <Check className="w-4 h-4" style={{ color: accent }} />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <footer className="px-6 py-12">
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-700">
          {brand.displayName} · part of the AuthiChain Protocol · Settlement on Polygon &amp; Bitcoin
        </p>
      </footer>
    </div>
  );
}
