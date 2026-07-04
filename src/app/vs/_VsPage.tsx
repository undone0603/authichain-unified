import Link from 'next/link';
import { Check, X, ArrowRight, ShieldCheck, Zap, DollarSign } from 'lucide-react';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';

const ACCENT = '#00FFD1';

export interface ComparisonRow {
  feature: string;
  authichain: boolean | string;
  competitor: boolean | string;
}

export interface VsPageProps {
  competitor: string;
  /** URL slug segment, e.g. "scantrust" */
  slug: string;
  /** One-line positioning of the competitor. */
  competitorSummary: string;
  rows: ComparisonRow[];
  reasons: { title: string; desc: string }[];
}

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-[13px] text-zinc-300">{value}</span>;
  }
  return value ? (
    <Check className="mx-auto h-5 w-5" style={{ color: ACCENT }} />
  ) : (
    <X className="mx-auto h-5 w-5 text-zinc-700" />
  );
}

export function VsPage({
  competitor,
  slug,
  competitorSummary,
  rows,
  reasons,
}: VsPageProps) {
  const breadcrumbLd = breadcrumbSchema([
    { name: 'Home', url: 'https://authichain.com' },
    { name: 'Compare', url: 'https://authichain.com/vs' },
    { name: `AuthiChain vs ${competitor}`, url: `https://authichain.com/vs/${slug}` },
  ]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#00FFD1] selection:text-black">
      <JsonLd data={breadcrumbLd} />

      {/* HERO */}
      <section className="relative px-6 pt-32 pb-20 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[460px] opacity-20"
          style={{ background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${ACCENT} 0%, transparent 60%)` }}
        />
        <div className="relative max-w-4xl mx-auto">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] mb-8"
            style={{ borderColor: `${ACCENT}55`, color: ACCENT, backgroundColor: `${ACCENT}12` }}
          >
            <ShieldCheck className="w-3 h-3" />
            Head-to-Head Comparison
          </span>
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter uppercase leading-[0.95]">
            AuthiChain vs {competitor}:<br />
            <span style={{ color: ACCENT }}>Which Is Better for Product Authentication?</span>
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-400 text-base md:text-lg font-medium leading-relaxed mb-10">
            {competitorSummary} Below is an honest, feature-by-feature comparison
            so you can decide which product authentication platform fits your
            supply chain, budget, and compliance timeline.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-black transition-transform hover:translate-y-[-2px]"
              style={{ backgroundColor: ACCENT }}
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors"
            >
              See Live Demo
            </Link>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="protocol-card overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_1fr] border-b border-zinc-900 bg-zinc-950/60">
            <div className="p-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Feature</div>
            <div className="p-5 text-center text-[11px] font-black uppercase tracking-widest" style={{ color: ACCENT }}>
              AuthiChain
            </div>
            <div className="p-5 text-center text-[11px] font-black uppercase tracking-widest text-zinc-400">
              {competitor}
            </div>
          </div>
          {rows.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-[1.6fr_1fr_1fr] items-center ${
                i % 2 ? 'bg-zinc-950/30' : ''
              }`}
            >
              <div className="p-5 text-[13px] font-medium text-zinc-300">{row.feature}</div>
              <div className="p-5 text-center">
                <Cell value={row.authichain} />
              </div>
              <div className="p-5 text-center">
                <Cell value={row.competitor} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY BRANDS CHOOSE AUTHICHAIN */}
      <section className="border-t border-zinc-900 px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4">
            Why Brands Choose <span style={{ color: ACCENT }}>AuthiChain</span>
          </h2>
          <p className="text-center text-sm text-zinc-500 mb-14 max-w-xl mx-auto leading-relaxed">
            Enterprise-grade authentication without the enterprise contract, the
            six-month onboarding, or the opaque pricing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[ShieldCheck, Zap, DollarSign].map((Icon, i) => (
              <div key={i} className="protocol-card p-8">
                <Icon className="w-6 h-6 mb-5" style={{ color: ACCENT }} />
                <h3 className="text-sm font-black uppercase tracking-tight mb-3">{reasons[i]?.title}</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">{reasons[i]?.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-900 px-6 py-24 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4">
          Switch to AuthiChain Today
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-sm text-zinc-500 leading-relaxed">
          Start authenticating products in under a day. No enterprise contract,
          transparent pricing, and blockchain-anchored proof your customers can verify.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-black transition-transform hover:translate-y-[-2px]"
          style={{ backgroundColor: ACCENT }}
        >
          Start Free Trial
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <footer className="px-6 py-12">
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-700">
          AuthiChain · Blockchain Product Authentication · EU DPP Compliant · Polygon &amp; Bitcoin Anchored
        </p>
      </footer>
    </div>
  );
}
