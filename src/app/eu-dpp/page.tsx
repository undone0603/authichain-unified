import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { faqSchema, breadcrumbSchema, type FaqItem } from '@/lib/structured-data';
import {
  ArrowRight,
  ShieldCheck,
  Leaf,
  FileText,
  Zap,
  Lock,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'EU Digital Product Passport Compliance | GovChain',
  description:
    'Blockchain-anchored Digital Product Passports, with signed records in development. No enterprise contract.',
  openGraph: {
    title: 'EU Digital Product Passport Compliance | GovChain',
    description:
      'Blockchain-anchored Digital Product Passports, with signed records in development. No enterprise contract.',
    url: 'https://govchain.us/eu-dpp',
  },
  twitter: {
    title: 'EU Digital Product Passport Compliance | GovChain',
    description:
      'Blockchain-anchored Digital Product Passports, with signed records in development. No enterprise contract.',
  },
};

const ACCENT = '#1B4FD8';
const ACCENT_LIGHT = '#3B82F6';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Built on Regulation (EU) 2024/1781',
    desc: 'Data model maps directly to the EU DPP framework — unique identifier, carbon footprint, material composition, and repairability scores in our data model.',
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
];

const TIMELINE = [
  { date: 'Jul 2026', label: 'EU DPP registry rules adopted (Implementing Regulation (EU) 2026/1778)', active: true, urgent: false },
  { date: 'Feb 2027', label: 'Battery Passport Mandatory (EV, Industrial)', active: true },
  { date: '2028', label: 'Textiles & Electronics — Delegated Regulations', active: false },
];

const FAQ: FaqItem[] = [
  {
    question: 'What is the EU Digital Product Passport?',
    answer:
      'The EU Digital Product Passport (DPP) is a structured digital record — mandated by the Ecodesign for Sustainable Products Regulation (ESPR, Regulation 2024/1781) — that stores a product’s identity, materials, carbon footprint, repairability, and end-of-life data. Each physical product carries a unique identifier (typically a QR code or NFC tag) that links to its passport, letting consumers, customs, and recyclers verify the data instantly.',
  },
  {
    question: 'When does the EU DPP regulation take effect?',
    answer:
      'Battery passports become mandatory for EV and industrial batteries in February 2027, textiles and electronics follow under delegated regulations from 2028. The regulation lets the EU require passports for most physical products, one product group at a time.',
  },
  {
    question: 'Which products need a Digital Product Passport?',
    answer:
      'Priority categories are batteries, textiles and apparel, electronics and ICT equipment, furniture, iron and steel, aluminium, tyres, and construction products. Scope expands through delegated acts. The regulation lets the EU require passports for most physical products, one product group at a time.',
  },
  {
    question: 'How does AuthiChain implement EU DPP?',
    answer:
      'AuthiChain (via its GovChain compliance layer) maps your product data directly to the EU DPP framework — unique identifier, material bill of materials, carbon footprint, and repairability score. Every passport is hashed and anchored on Polygon for tamper-proof integrity, and we auto-generate the EPCIS 2.0 and JSON-LD payloads required for EU registry submission. No manual data entry, no compliance consultant.',
  },
  {
    question: 'What is the cost of EU DPP compliance?',
    answer:
      'Contact for pricing. No enterprise contract is required.',
  },
  {
    question: 'How long does AuthiChain DPP setup take?',
    answer:
      'Guided onboarding is in development. Contact us at authichain.com/contact to scope a pilot.',
  },
];

export default function EuDppPage() {
  const faqLd = faqSchema(FAQ);
  const breadcrumbLd = breadcrumbSchema([
    { name: 'Home', url: 'https://govchain.us' },
    { name: 'EU Digital Product Passport', url: 'https://govchain.us/eu-dpp' },
  ]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600 selection:text-white">
      <JsonLd data={[faqLd, breadcrumbLd]} />
      {/* HERO */}
      <section className="relative px-6 pt-32 pb-24 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] opacity-25"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${ACCENT}66 0%, transparent 60%)`,
          }}
        />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-[0.92]">
            EU Digital<br />
            <span style={{ color: ACCENT_LIGHT }}>Product Passports</span>
          </h1>

          <p className="max-w-2xl mx-auto text-zinc-400 text-base md:text-lg font-medium leading-relaxed mb-10">
            GovChain issues blockchain-anchored DPPs that meet Regulation (EU) 2024/1781.
            No enterprise contract. Start with a scoped pilot.
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
            { value: 'EU 2024/1781', label: 'Regulation' },
            { value: 'Polygon', label: 'Anchored On-Chain' },
            { value: 'EPCIS 2.0', label: 'Export Format' },
            { value: 'In Development', label: 'Guided Onboarding' },
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
            provenance. Required under Regulation (EU) 2024/1781 (Ecodesign for Sustainable Products), it starts with
            batteries in February 2027. The regulation lets the EU require passports for most physical products, one product group at a time.
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed">
            GovChain handles the entire technical stack so your team focuses on business,
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
          One platform. Every data field mandated by Regulation (EU) 2024/1781. Our goal is passport records ready for submission to the EU registry.
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
                desc: 'Each product gets a unique DPP — hashed and anchored on Polygon in seconds (Ed25519-signed records are in development). Your QR code is ready to print.',
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

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-24">
        <h2 className="text-center text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4">
          EU DPP <span style={{ color: ACCENT_LIGHT }}>Frequently Asked</span>
        </h2>
        <p className="text-center text-sm text-zinc-500 mb-12 max-w-xl mx-auto leading-relaxed">
          Everything brands need to know about the Digital Product Passport
          regulation and how AuthiChain helps you prepare.
        </p>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <details
              key={item.question}
              className="protocol-card group p-6 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-black uppercase tracking-tight text-white">
                {item.question}
                <span
                  className="text-lg transition-transform group-open:rotate-45"
                  style={{ color: ACCENT_LIGHT }}
                >
                  +
                </span>
              </summary>
              <p className="mt-4 text-[13px] leading-relaxed text-zinc-400">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="border-t border-zinc-900 px-6 py-24 text-center">
        <p className="mx-auto mb-10 max-w-xl text-sm text-zinc-500 leading-relaxed">
          Guided onboarding is in development.
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
          {['No enterprise contract', 'Guided onboarding in development', 'Polygon-anchored', 'EPCIS 2.0 export'].map((t) => (
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
