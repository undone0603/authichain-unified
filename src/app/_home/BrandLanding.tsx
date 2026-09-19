import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { BRANDS, type BrandId } from '@shared/brands';
import { LIGHT_ACCENT } from '@/lib/estate-accents';
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
  /** Primary hero CTA (defaults to the brand's conversion path). */
  primaryCta?: LandingCta;
  /** Secondary hero CTA. */
  secondaryCta?: LandingCta;
  /**
   * Extra conversion sections rendered between the feature grid and the
   * closing CTA (e.g. competitor table, ROI calculator on AuthiChain).
   */
  children?: ReactNode;
}

const DEFAULT_PRIMARY: Record<BrandId, LandingCta> = {
  authichain: { label: 'Open dashboard', href: '/dashboard' },
  qron: { label: 'Generate Living QR', href: '/generate' },
  strainchain: { label: 'Request demo', href: '/onboard' },
  govchain: { label: 'Request access', href: '/onboard' },
};

/**
 * Shared light-enterprise landing shell for AuthiChain / QRON / StrainChain /
 * GovChain. Server component — no client state. Conversion destinations stay
 * on the live first-dollar paths.
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
  children,
}: BrandLandingProps) {
  const brand = BRANDS[brandId];
  const accent = LIGHT_ACCENT[brandId];
  const primary = primaryCta ?? DEFAULT_PRIMARY[brandId];
  const secondary = secondaryCta ?? { label: 'View pricing', href: '/pricing' };

  return (
    <div className={`min-h-screen bg-white text-slate-900 ${themeClass ?? ''}`}>
      <section className="relative px-6 pt-28 pb-20 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[320px]"
          style={{
            background: `radial-gradient(ellipse 70% 50% at 10% 0%, ${accent}22 0%, transparent 60%)`,
          }}
        />
        <div className="relative max-w-3xl">
          <p
            className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] mb-6"
            style={{ borderColor: `${accent}55`, color: accent, backgroundColor: `${accent}14` }}
          >
            {brand.displayName} · {eyebrow}
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-5 text-slate-950">
            {headline ?? brand.tagline}
          </h1>
          <p className="max-w-2xl text-slate-600 text-base md:text-lg leading-relaxed mb-8">
            {subhead ?? brand.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={primary.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: accent, outlineColor: accent }}
            >
              {primary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={secondary.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </section>

      <TrustRail accent={accent} />

      {stats && stats.length > 0 && (
        <section aria-label="Product capabilities" className="border-y border-slate-200 bg-slate-50">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="px-6 py-8">
                <div className="text-2xl font-semibold text-slate-950">{s.value}</div>
                <div className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
              <div
                className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                {f.icon}
              </div>
              <h3 className="text-base font-semibold tracking-tight mb-2 text-slate-950">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {children}

      <section className="border-t border-slate-200 bg-slate-50 px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-slate-950">
            {closingLine}
          </h2>
          <p className="mb-8 text-sm text-slate-600">
            Start on the live conversion path for this brand. Certificates stay cryptographically signed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={primary.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {primary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 hover:border-slate-400"
            >
              Contact
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
            {['Polygon-anchored', 'Stripe checkout', 'No invented customer logos'].map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Check className="w-4 h-4" style={{ color: accent }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="px-6 py-12 border-t border-slate-200 bg-white">
        <nav aria-label="Estate" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 mb-6">
          <Link href="/dashboard" className="hover:text-slate-950">Dashboard</Link>
          <Link href="/onboard" className="hover:text-slate-950">Onboard</Link>
          <Link href="/generate" className="hover:text-slate-950">Generate</Link>
          <Link href="/api/checkout/dpp" className="hover:text-slate-950">DPP checkout</Link>
          <a href="https://qron.space" className="hover:text-slate-950">QRON</a>
          <a href="https://govchain.us" className="hover:text-slate-950">GovChain</a>
          <a href="https://strainchain.io" className="hover:text-slate-950">StrainChain</a>
        </nav>
        <p className="text-xs text-slate-500">
          © 2026 {brand.displayName} · AuthiChain estate · Settlement on Polygon
        </p>
      </footer>

      <StickyConversionBar accent={accent} href={primary.href} label={primary.label} />
      <ExitIntentGuide accent={accent} productInterest={brandId} />
    </div>
  );
}
