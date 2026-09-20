import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Made in America origin claims | AuthiChain',
  description:
    'Substantiate Made in USA / Made in America origin claims with a signed per-unit record. FTC 16 CFR Part 323 and EO 14392 context. Start EU DPP Readiness at $299.',
};

export default function MadeInAmericaPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section className="px-6 pt-28 pb-16">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 mb-4">
            Made in America
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-slate-950 mb-5">
            Prove the origin claim before anyone asks.
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed mb-8 max-w-2xl">
            The FTC Made in USA Labeling Rule (16 CFR Part 323) turns on whether all or
            virtually all of a product is US-origin. Executive Order 14392 told the FTC
            to prioritize truthful Made in America advertising. A signed, per-unit record
            is documentation — it does not replace meeting the standard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/api/checkout/dpp" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white">
              DPP checkout — $299
            </Link>
            <Link href="/partners/brief" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900">
              Partner brief
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20 grid gap-5 md:grid-cols-3">
        {[
          { t: 'FTC 16 CFR Part 323', d: 'Unqualified Made in USA claims need competent and reliable evidence that all or virtually all of the product is US-origin.' },
          { t: 'EO 14392', d: 'Directs agencies on Made in America advertising priority. Context for the April 2026 sweep, not a product certification.' },
          { t: 'USDA Product of USA', d: 'A separate meat, poultry, and egg standard. Do not collapse it into the FTC rule.' },
        ].map((c) => (
          <article key={c.t} className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950 mb-2">{c.t}</h2>
            <p className="text-sm text-slate-600">{c.d}</p>
          </article>
        ))}
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-slate-950 mb-3">Start EU DPP Readiness</h2>
          <p className="text-sm text-slate-600 mb-6">
            Live self-serve checkout at $299. Channel partners: request the written packet
            at hello@authichain.com. No call booking.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/api/checkout/dpp" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white">
              Start DPP checkout
            </Link>
            <a
              href="mailto:hello@authichain.com?subject=Made%20in%20America%20written%20packet"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
            >
              Request a written packet
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
