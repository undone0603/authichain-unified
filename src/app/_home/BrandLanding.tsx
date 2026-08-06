import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { BRANDS, type BrandId } from '@shared/brands';
import { TrustRail } from '@/components/TrustRail';
import { StickyConversionBar } from '@/components/StickyConversionBar';
import { ExitIntentGuide } from '@/components/ExitIntentGuide';

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

/** A single step in the "How it works" explainer. */
export interface LandingStep {
  title: string;
  desc: string;
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
  /** Short, reassuring hero highlights shown as a checkmark row under the CTAs. */
  heroPoints?: string[];
  /** Vertical-specific value props. */
  features: LandingFeature[];
  /** Optional heading + intro above the feature grid, for context. */
  featuresHeading?: string;
  featuresIntro?: string;
  /** Optional headline stat strip. */
  stats?: LandingStat[];
  /** Optional 3-step "How it works" explainer (informative section). */
  howItWorks?: LandingStep[];
  /** Optional "Who it's for" audience chips. */
  audiences?: string[];
  /** Closing pitch above the pricing CTA. */
  closingLine: string;
  /** Primary hero CTA (defaults to the brand's ctaLabel → ctaHref). */
  primaryCta?: LandingCta;
  /** Secondary hero CTA (defaults to View Pricing → /pricing). */
  secondaryCta?: LandingCta;
  /**
   * Extra conversion sections rendered between the feature grid and the
   * closing CTA (e.g. competitor table, ROI calculator on AuthiChain).
   */
  children?: ReactNode;
}

/**
 * Shared landing shell for the non-QRON brands (AuthiChain / StrainChain /
 * GovChain). Server component — no client state. Brand copy + CTA destinations
 * come from the canonical `shared/brands.ts`; the accent color is driven by
 * each brand's `accentHex` so every domain presents on-brand.
 *
 * The layout leads with a clear, human hero, explains the product with a
 * "How it works" section and a labelled feature grid, states who it's for,
 * and closes on pricing — inviting first, informative throughout, converting last.
 */
export function BrandLanding({
  brandId,
  themeClass,
  eyebrow,
  headline,
  subhead,
  heroPoints,
  features,
  featuresHeading,
  featuresIntro,
  stats,
  howItWorks,
  audiences,
  closingLine,
  primaryCta,
  secondaryCta,
  children,
}: BrandLandingProps) {
  const brand = BRANDS[brandId];
  const accent = brand.accentHex;
  const primary = primaryCta ?? { label: brand.ctaLabel, href: brand.ctaHref };
  const secondary = secondaryCta ?? { label: 'View Pricing', href: '/pricing' };
  const points = heroPoints ?? ['Free to start', 'Verify in one scan', 'No hardware required'];

  return (
    <div className={`min-h-screen bg-black text-white ${themeClass ?? ''}`}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-6 pt-32 pb-20 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-40"
          style={{
            background: `radial-gradient(ellipse 75% 55% at 50% -10%, ${accent}2e 0%, transparent 62%)`,
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <span
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ borderColor: `${accent}40`, color: accent, backgroundColor: `${accent}0d` }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {brand.displayName} · {eyebrow}
          </span>
          <h1 className="mb-6 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            {headline ?? brand.tagline}
          </h1>
          <p className="mx-auto mb-9 max-w-2xl text-lg font-medium leading-relaxed text-zinc-300 md:text-xl">
            {subhead ?? brand.description}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href={primary.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-9 py-4 text-sm font-bold tracking-wide text-black shadow-lg transition-transform hover:translate-y-[-2px]"
              style={{ backgroundColor: accent, boxShadow: `0 10px 40px -12px ${accent}80` }}
            >
              {primary.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={secondary.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-9 py-4 text-sm font-bold tracking-wide text-white transition-colors hover:border-zinc-500 hover:bg-zinc-900"
            >
              {secondary.label}
            </Link>
          </div>
          <ul className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-x-6 gap-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[13px] font-medium text-zinc-400">
                <Check className="h-4 w-4 shrink-0" style={{ color: accent }} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Social-proof / trust rail — directly below the hero */}
      <TrustRail accent={accent} />

      {/* Stat strip */}
      {stats && stats.length > 0 && (
        <section className="border-y border-zinc-900 bg-zinc-950/40">
          <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-zinc-900 md:grid-cols-4">
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

      {/* ── How it works (informative) ───────────────────────────────────── */}
      {howItWorks && howItWorks.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">How it works</h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              Up and running in three steps — no blockchain expertise required.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {howItWorks.map((step, i) => (
              <div key={step.title} className="relative rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8">
                <div
                  className="mb-5 flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-black"
                  style={{ backgroundColor: accent }}
                >
                  {i + 1}
                </div>
                <h3 className="mb-3 text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        {(featuresHeading || featuresIntro) && (
          <div className="mx-auto mb-14 max-w-2xl text-center">
            {featuresHeading && (
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">{featuresHeading}</h2>
            )}
            {featuresIntro && (
              <p className="mt-4 text-base leading-relaxed text-zinc-400">{featuresIntro}</p>
            )}
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="protocol-card rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 transition-colors hover:border-zinc-700"
            >
              <div
                className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}1a`, color: accent }}
              >
                {f.icon}
              </div>
              <h3 className="mb-3 text-base font-bold tracking-tight">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────────────── */}
      {audiences && audiences.length > 0 && (
        <section className="border-y border-zinc-900 bg-zinc-950/40 px-6 py-16">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Built for
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {audiences.map((a) => (
                <span
                  key={a}
                  className="rounded-full border px-5 py-2.5 text-sm font-medium text-zinc-200"
                  style={{ borderColor: `${accent}30`, backgroundColor: `${accent}0a` }}
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Brand-specific conversion sections (competitor table, ROI calc, …) */}
      {children}

      {/* Animated live-stats counter band */}
      <LiveStatsCounter accent={accent} />

      {/* ── Closing CTA → pricing (revenue) ──────────────────────────────── */}
      <section className="border-t border-zinc-900 px-6 py-24 text-center">
        <h2 className="mx-auto mb-5 max-w-2xl text-3xl font-black tracking-tight md:text-4xl">
          {closingLine}
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-zinc-400">
          Start free — every record is cryptographically signed and anchored on-chain.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-9 py-4 text-sm font-bold tracking-wide text-black shadow-lg transition-transform hover:translate-y-[-2px]"
            style={{ backgroundColor: accent, boxShadow: `0 10px 40px -12px ${accent}80` }}
          >
            See plans &amp; pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-9 py-4 text-sm font-bold tracking-wide text-white transition-colors hover:border-zinc-500 hover:bg-zinc-900"
          >
            Talk to sales
          </Link>
        </div>
        <ul className="mx-auto mt-12 flex max-w-2xl flex-wrap justify-center gap-x-8 gap-y-3">
          {['Polygon-anchored', 'Stripe-secured checkout', 'No setup fees'].map((t) => (
            <li key={t} className="flex items-center gap-2 text-[12px] font-medium text-zinc-500">
              <Check className="h-4 w-4" style={{ color: accent }} />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <footer className="px-6 py-12">
        <p className="text-center text-[11px] font-medium text-zinc-600">
          © 2026 {brand.displayName} · part of the AuthiChain Protocol · Settlement on Polygon &amp; Bitcoin
        </p>
      </footer>

      {/* Sticky conversion bar + exit-intent EU DPP guide */}
      <StickyConversionBar accent={accent} href={primary.href} />
      <ExitIntentGuide accent={accent} productInterest={brandId} />
    </div>
  );
}
