import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Leaf,
  FileText,
  Zap,
  Globe,
  Lock,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Activity,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'EU Digital Product Passport Compliance | GovChain',
  description:
    'The EU DPP registry opens July 19, 2026. Get your blockchain-anchored Digital Product Passport before the deadline. GovChain vs Scantrust, VeChain, Circularise.',
  openGraph: {
    title: 'Get EU DPP Compliant Before July 19 | GovChain',
    description:
      'Registry opens in days. Issue cryptographically-signed Digital Product Passports via GovChain — no enterprise contract, no 6-month onboarding.',
    url: 'https://govchain.us/eu-dpp',
  },
};

const ACCENT = '#1B4FD8';
const ACCENT_LIGHT = '#3B82F6';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Regulation 2024/1789 Ready',
    desc: 'Data model maps directly to the EU DPP framework — unique identifier, carbon footprint, material composition, and repairability scores out of the box.',
  },
  {
    icon: Lock,
    title: 'Polygon-Anchored Integrity',
    desc: 'Every passport is hashed and anchored on-chain. Customs officers and auditors verify authenticity in one scan — no vendor call required.',
  },
  {
    icon: Zap,
    title: 'Registry Export in Seconds',
    desc: 'Generate the EPCIS 2.0 and JSON-LD payloads required for EU registry submission automatically. No manual data-entry, no compliance consultant.',
  },
  {
    icon: Leaf,
    title: 'Full Lifecycle Carbon Data',
    desc: 'Ingest supplier LCA data, calculate embodied carbon, and attach verified scope 1–3 emissions to each unit — auditable at the product level.',
  },
  {
    icon: FileText,
    title: 'Material Bill of Materials',
    desc: 'Declare hazardous substances, recycled content percentage, and spare-parts availability per the EU Ecodesign Regulation requirements.',
  },
  {
    icon: Globe,
    title: 'Multi-Market Distribution',
    desc: 'One GovChain record serves EU DPP, UK PIPA, and US product traceability requirements — one integration, three compliance frameworks.',
  },
];

const TIMELINE = [
  { date: 'July 19, 2026', label: 'Central EU DPP Registry Opens', active: true, urgent: true },
  { date: 'Feb 2027', label: 'Battery Passport Mandatory (EV, Industrial)', active: true },
  { date: '2028', label: 'Textiles & Electronics — Delegated Regulations', active: false },
  { date: '2030', label: 'All EU Physical Goods — Full Scope', active: false },
];

const COMPARISON = [
  { feature: 'No enterprise contract required', govchain: true, scantrust: false, vechain: false, circularise: false },
  { feature: 'On-chain cryptographic anchoring', govchain: true, scantrust: false, vechain: true, circularise: false },
  { feature: 'EPCIS 2.0 + JSON-LD export', govchain: true, scantrust: true, vechain: true, circularise: true },
  { feature: 'Self-serve onboarding < 1 day', govchain: true, scantrust: false, vechain: false, circularise: false },
  { feature: 'Transparent public pricing', govchain: true, scantrust: false, vechain: false, circularise: false },
  { feature: 'US federal procurement (FAR/SAM.gov)', govchain: true, scantrust: false, vechain: false, circularise: false },
];

export default function EuDppPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600 selection:text-white">
      {/* HERO */}
      <section className="relative px-6 pt-32 pb-24 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] opacity-25"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${ACCENT}66 0%, transparent 60%)`,
          }}
        />
        <div className="relative max-w-4xl mx-auto">
          {/* Urgency chip */}
          <span
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] mb-8 animate-pulse"
            style={{ borderColor: `${ACCENT_LIGHT}60`, color: ACCENT_LIGHT, backgroundColor: `${ACCENT}15` }}
          >
            <Clock className="w-3 h-3" />
            EU DPP Registry Opens July 19, 2026
          </span>

          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-[0.92]">
            Get Compliant<br />
            <span style={{ color: ACCENT_LIGHT }}>Before July&nbsp;19</span>
          </h1>

          <p className="max-w-2xl mx-auto text-zinc-400 text-base md:text-lg font-medium leading-relaxed mb-10">
            The EU Digital Product Passport registry goes live July 19, 2026.
            GovChain issues blockchain-anchored DPPs that meet Regulation 2024/1789
            — self-serve, no 6-month onboarding, no enterprise contract.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-white transition-transform hover:translate-y-[-2px]"
              style={{ backgroundColor: ACCENT }}
            >
              Get a Compliance Demo
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-zinc-900 bg-zinc-950/40">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-900">
          {[
            { value: 'EU 2024/1789', label: 'Regulation' },
            { value: 'Polygon', label: 'Anchored On-Chain' },
            { value: 'EPCIS 2.0', label: 'Export Format' },
            { value: '< 1 Day', label: 'Onboarding' },
          ].map((s) => (
            <div key={s.label} className="px-6 py-8 text-center">
              <div className="text-2xl font-black" style={{ color: ACCENT_LIGHT }}>
                {s.value}
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT IS EU DPP */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-zinc-900" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">What Is the EU DPP?</h2>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>
        <div className="protocol-card p-10">
          <p className="text-zinc-300 text-base leading-relaxed mb-6">
            The EU Digital Product Passport (DPP) is a machine-readable data record — accessible via QR code — that
            carries a product's environmental footprint, material composition, repair instructions, and supply chain
            provenance. Required under EU Regulation 2024/1789 (Ecodesign for Sustainable Products), it applies to
            every physical good sold in the EU market starting with batteries in February 2027, with full scope by 2030.
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed">
            The central EU DPP registry — the backbone that validates and indexes all passports — goes live{' '}
            <strong className="text-white">July 19, 2026</strong>. Brands must register and issue valid passports or
            risk losing EU market access. GovChain handles the entire technical stack so your team focuses on business,
            not blockchain.
          </p>
        </div>
      </section>

      {/* COMPLIANCE TIMELINE */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-zinc-900" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Compliance Timeline</h2>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>
        <div className="space-y-3">
          {TIMELINE.map((item) => (
            <div
              key={item.date}
              className={`protocol-card p-6 flex justify-between items-center ${
                item.urgent
                  ? 'border-blue-600/40 bg-blue-950/20'
                  : item.active
                  ? 'opacity-80'
                  : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-6">
                <span
                  className="text-sm font-black uppercase tracking-widest"
                  style={{ color: item.urgent ? ACCENT_LIGHT : item.active ? '#6B7280' : '#374151' }}
                >
                  {item.date}
                </span>
                <span className="text-sm font-bold text-zinc-300 uppercase tracking-tight">{item.label}</span>
              </div>
              {item.urgent && <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-center mb-4">
          Everything Required for{' '}
          <span style={{ color: ACCENT_LIGHT }}>EU DPP Compliance</span>
        </h2>
        <p className="text-center text-zinc-500 text-sm font-medium mb-16 max-w-xl mx-auto">
          One platform. Every data field mandated by Regulation 2024/1789. Ready for registry submission on day one.
        </p>
        <div className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="protocol-card p-8 group hover:border-blue-600/40 transition-all">
              <div
                className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${ACCENT}20`, color: ACCENT_LIGHT }}
              >
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-tight mb-3">{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPETITOR COMPARISON */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-zinc-900" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">GovChain vs. Alternatives</h2>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>
        <div className="protocol-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-5 border-b border-zinc-900 bg-zinc-950">
            <div className="col-span-2 p-5 text-[10px] font-black uppercase tracking-widest text-zinc-600">Feature</div>
            <div
              className="p-5 text-center text-[10px] font-black uppercase tracking-widest"
              style={{ color: ACCENT_LIGHT }}
            >
              GovChain
            </div>
            <div className="p-5 text-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
              Scantrust
            </div>
            <div className="p-5 text-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
              VeChain / Circularise
            </div>
          </div>
          {/* Rows */}
          {COMPARISON.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-5 border-b border-zinc-900 ${i % 2 === 0 ? 'bg-zinc-950/30' : ''}`}
            >
              <div className="col-span-2 p-5 text-[12px] font-medium text-zinc-300">{row.feature}</div>
              <div className="p-5 flex justify-center items-center">
                {row.govchain ? (
                  <CheckCircle className="w-5 h-5" style={{ color: ACCENT_LIGHT }} />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-800" />
                )}
              </div>
              <div className="p-5 flex justify-center items-center">
                {row.scantrust ? (
                  <CheckCircle className="w-5 h-5 text-zinc-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-800" />
                )}
              </div>
              <div className="p-5 flex justify-center items-center">
                {row.vechain ? (
                  <CheckCircle className="w-5 h-5 text-zinc-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-800" />
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[10px] text-zinc-700 uppercase tracking-widest">
          Competitor data based on publicly available pricing & product pages as of July 2026.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-zinc-900 bg-zinc-950/40 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-center mb-14">
            From Signup to Registry in{' '}
            <span style={{ color: ACCENT_LIGHT }}>3 Steps</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect Your Data',
                desc: 'Import your product catalog via CSV, API, or our ERP connectors. GovChain maps your fields to the EU DPP schema automatically.',
              },
              {
                step: '02',
                title: 'Issue Passports',
                desc: 'Each product gets a unique DPP — hashed, signed with Ed25519, and anchored on Polygon in seconds. Your QR code is ready to print.',
              },
              {
                step: '03',
                title: 'Submit to Registry',
                desc: 'One-click EPCIS 2.0 export to the EU central registry. Compliance officers and customs get a verifiable record with a single scan.',
              },
            ].map((s) => (
              <div key={s.step} className="protocol-card p-8">
                <div
                  className="text-4xl font-black mb-4 opacity-30"
                  style={{ color: ACCENT_LIGHT }}
                >
                  {s.step}
                </div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-3">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATUS BADGE */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="protocol-card p-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Platform Status</p>
              <p className="text-sm font-black text-white uppercase">Registry-Ready · Accepting EU DPP Onboarding</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            All Systems Operational
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="border-t border-zinc-900 px-6 py-24 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4">
          Don't Miss the July 19 Deadline
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-sm text-zinc-500 leading-relaxed">
          Setup takes less than one business day. Brands that register early get priority review from our EU compliance
          team and guaranteed registry submission before the July 19 launch window.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-white transition-transform hover:translate-y-[-2px]"
            style={{ backgroundColor: ACCENT }}
          >
            Book EU Compliance Demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors"
          >
            See Plans & Pricing
          </Link>
        </div>
        <ul className="mx-auto mt-12 flex max-w-2xl flex-wrap justify-center gap-x-8 gap-y-3">
          {['No enterprise contract', 'Self-serve < 1 day', 'Polygon-anchored', 'EPCIS 2.0 export'].map((t) => (
            <li
              key={t}
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500"
            >
              <CheckCircle className="w-4 h-4" style={{ color: ACCENT_LIGHT }} />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <footer className="px-6 py-12">
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-700">
          GovChain · part of the AuthiChain Protocol · EU DPP Compliance · Polygon Anchored
        </p>
      </footer>
    </div>
  );
}
