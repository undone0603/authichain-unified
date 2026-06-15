import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  CheckCircle,
  ArrowRight,
  Clock,
  Globe,
  Lock,
  BarChart3,
  Layers,
  Cpu,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'EU Digital Product Passport Compliance | AuthiChain',
  description:
    'Achieve EU Digital Product Passport (DPP) compliance in minutes. Blockchain-anchored QR codes from $49. Battery Passport ready for 2027 EU mandate. Beats Scantrust & VeChain on price.',
  keywords: [
    'EU digital product passport',
    'DPP compliance',
    'product passport EU regulation',
    'battery passport 2027',
    'blockchain product authentication',
    'QR code product passport',
    'EU DPP registry',
    'digital product passport blockchain',
  ],
  alternates: {
    canonical: '/eu-dpp',
  },
  openGraph: {
    title: 'EU Digital Product Passport Compliance | AuthiChain',
    description:
      'EU DPP registry opens July 19, 2026. Get blockchain-anchored product passports from $49 — ready in 5 minutes. AuthiChain vs Scantrust vs VeChain.',
    url: 'https://authichain.com/eu-dpp',
    siteName: 'AuthiChain',
    images: [
      {
        url: '/media/samples/03_flux_authichain.png',
        width: 1200,
        height: 630,
        alt: 'AuthiChain EU Digital Product Passport Compliance',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EU Digital Product Passport Compliance | AuthiChain',
    description:
      'EU DPP registry opens July 19, 2026. Blockchain product passports from $49. Ready in 5 minutes.',
    images: ['/media/samples/03_flux_authichain.png'],
    creator: '@AuthiChain',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AuthiChain EU Digital Product Passport Platform',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://authichain.com/eu-dpp',
  description:
    'Blockchain-anchored EU Digital Product Passport compliance platform. Generate serialized QR codes, supply chain traceability records, and battery passport data for EU regulation compliance starting July 2026.',
  offers: [
    {
      '@type': 'Offer',
      name: 'QRON Single DPP',
      price: '49',
      priceCurrency: 'USD',
      description: 'Single EU Digital Product Passport — blockchain anchored, DPP compliant.',
      url: 'https://buy.stripe.com/14A4gz9brgbQdOG4ba1Nu0w',
    },
    {
      '@type': 'Offer',
      name: 'QRON Brand Pack',
      price: '199',
      priceCurrency: 'USD',
      description: 'Brand Pack — 5 DPP-compliant product passports with AI art QR codes.',
      url: 'https://buy.stripe.com/aFabJ1cnD9Ns25Y7nm1Nu0A',
    },
    {
      '@type': 'Offer',
      name: 'AuthiChain Enterprise DPP',
      price: '999',
      priceCurrency: 'USD',
      description: 'Enterprise monthly plan — unlimited product passports, API access, supply chain traceability.',
      url: 'https://buy.stripe.com/aFaaEX9br4t8dOG8rq1Nu0y',
    },
  ],
  featureList: [
    'EU Digital Product Passport (DPP) compliance',
    'Serialized QR codes for product identity',
    'Blockchain-anchored supply chain traceability',
    'Battery Passport 2027 ready',
    'EU Regulation 2024/1789 compliant data export',
    'Polygon network immutable record anchoring',
    'Ed25519 cryptographic signing',
    'Carbon footprint and material composition tracking',
    'AI art QR codes with 100% scan guarantee',
    'Sub-5-minute DPP generation',
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '47',
  },
};

// Deadline countdown — July 19, 2026 UTC — computed at request time (server component)
const DEADLINE = new Date('2026-07-19T00:00:00Z');
const daysLeft = Math.max(0, Math.ceil((DEADLINE.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

export default function EuDppPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gold/5 blur-[140px] rounded-full opacity-60 pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <AlertTriangle className="w-3 h-3" />
            EU DPP Registry Opens in {daysLeft} Days — July 19, 2026
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-[0.9]">
            EU DPP Compliance,<br />
            <span className="gold-text">Ready in Minutes</span>
          </h1>

          <p className="max-w-2xl mx-auto text-zinc-400 text-lg md:text-xl font-medium mb-4 leading-relaxed">
            The EU Digital Product Passport mandate is live. AuthiChain generates
            blockchain-anchored, regulation-ready product passports from{' '}
            <strong className="text-white">$49</strong> — no enterprise contract required.
          </p>
          <p className="max-w-xl mx-auto text-zinc-600 text-sm mb-12 leading-relaxed">
            Serialized QR codes · Supply chain traceability · Battery passport 2027 ready ·
            Blockchain product authentication that EU regulators can verify instantly.
          </p>

          {/* Deadline countdown strip */}
          <div className="inline-flex items-center gap-8 px-10 py-5 rounded-2xl bg-zinc-950 border border-zinc-800 mb-12">
            <div className="text-center border-r border-zinc-800 pr-8">
              <p className="text-3xl font-black text-white tracking-tighter">{daysLeft}</p>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Days Until Registry</p>
            </div>
            <div className="text-center border-r border-zinc-800 pr-8">
              <p className="text-3xl font-black text-gold tracking-tighter">Feb 2027</p>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Battery Passports Mandatory</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-white tracking-tighter">2030</p>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">All EU Physical Goods</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://buy.stripe.com/14A4gz9brgbQdOG4ba1Nu0w"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold px-10 py-4 font-black uppercase tracking-widest text-xs inline-flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Start DPP Compliance — $49
            </a>
            <Link
              href="/"
              className="btn-outline-gold px-10 py-4 font-black uppercase tracking-widest text-xs inline-flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              See Full Platform
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-700">
            <span>Polygon Anchored</span>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <span>Ed25519 Cryptographic Signing</span>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <span>EU Regulation 2024/1789 Compliant</span>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <span>100% Scan Guarantee</span>
          </div>
        </div>
      </section>

      <div className="gold-divider" />

      {/* ── PROBLEM ─────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="protocol-badge mb-6 inline-flex">
            <AlertTriangle className="w-3 h-3" />
            What the EU DPP Mandate Requires
          </span>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mt-4 mb-6">
            Every Product Sold in the EU <br />
            <span className="gold-text">Needs a Digital Passport</span>
          </h2>
          <p className="max-w-2xl mx-auto text-zinc-500 leading-relaxed">
            EU Regulation 2024/1789 mandates that physical goods carry a machine-readable
            <strong className="text-zinc-300"> product passport EU regulation</strong> record.
            Non-compliance risks market access bans across all 27 EU member states.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: BarChart3,
              title: 'Serialized QR Codes',
              desc: 'Each product unit requires a unique, machine-readable QR code linking to a verifiable digital record — not a generic batch barcode.',
              highlight: true,
            },
            {
              icon: Layers,
              title: 'Product Data Record',
              desc: 'Material composition, carbon footprint, hazardous substances, repairability scores, and manufacturer declarations must be accessible on scan.',
              highlight: false,
            },
            {
              icon: Globe,
              title: 'Supply Chain Traceability',
              desc: 'Auditable chain of custody from raw material origin through manufacturing, transport, and retail — verifiable by EU customs and consumers.',
              highlight: false,
            },
          ].map(({ icon: Icon, title, desc, highlight }) => (
            <div
              key={title}
              className={`protocol-card p-8 group hover:border-gold/40 transition-all ${
                highlight ? 'border-gold/20 bg-gold/5' : ''
              }`}
            >
              <Icon className="w-8 h-8 text-gold mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-base font-black uppercase tracking-tight mb-3 text-white">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Battery Passport callout */}
        <div className="mt-8 protocol-card p-8 bg-zinc-950 border-amber-500/20">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
              <Cpu className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-2">
                Battery Passport 2027 — Critical Deadline
              </p>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
                February 2027: EV &amp; Industrial Battery Passports Become Mandatory
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Every electric vehicle battery and industrial energy storage system sold in the EU must carry
                a <strong className="text-zinc-300">battery passport 2027</strong> — with state of health,
                cycle count, capacity, carbon footprint, and recycled material percentage.
                AuthiChain&apos;s blockchain product authentication covers all required fields.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="gold-divider" />

      {/* ── SOLUTION ────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="protocol-badge mb-6 inline-flex">
            <ShieldCheck className="w-3 h-3" />
            How AuthiChain Solves It
          </span>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mt-4 mb-6">
            Blockchain Product Passport <br />
            <span className="gold-text">in 5 Minutes, Not 5 Months</span>
          </h2>
          <p className="max-w-2xl mx-auto text-zinc-500 leading-relaxed">
            AuthiChain generates DPP-compliant, blockchain-anchored product passports with
            AI art QR codes. No procurement process, no six-figure contract, no 6-month integration.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* How it works steps */}
          <div className="space-y-6">
            {[
              {
                step: '01',
                title: 'Enter Product Data',
                desc: 'Input your product details, material composition, and supply chain data through our API or dashboard. Supports EU JSON/XML export formats.',
              },
              {
                step: '02',
                title: 'AI Generates Your QR Code',
                desc: 'Our AI art engine creates a unique, brand-matched QR code product passport — scannable by any phone camera, no special app needed.',
              },
              {
                step: '03',
                title: 'Blockchain Anchor',
                desc: 'Every EU digital product passport is cryptographically signed with Ed25519 and anchored immutably on the Polygon network in under 3 seconds.',
              },
              {
                step: '04',
                title: 'EU Registry Submission',
                desc: 'Export your DPP record in regulation-compliant formats for submission to the EU Central DPP Registry opening July 19, 2026.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-5 items-start">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                  <span className="text-[10px] font-black text-gold tracking-widest">{step}</span>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white mb-1">{title}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Key differentiators */}
          <div className="protocol-card p-8 bg-zinc-950/80 border-gold/15">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gold mb-8">
              Why AuthiChain for DPP Compliance
            </h3>
            <div className="space-y-5">
              {[
                {
                  icon: Zap,
                  title: '$49 per product',
                  desc: 'Competitors charge $50K+ enterprise minimums. AuthiChain starts at $49 for a single QR code product passport.',
                },
                {
                  icon: Clock,
                  title: '5-minute setup',
                  desc: 'No sales calls, no 90-day integration. Start generating EU DPP-compliant records immediately.',
                },
                {
                  icon: Lock,
                  title: 'Blockchain transparency',
                  desc: 'Every blockchain product authentication record is publicly verifiable — EU regulators, customs, and consumers can all verify instantly.',
                },
                {
                  icon: Sparkles,
                  title: 'AI art QR codes',
                  desc: 'Industry-first: your product passport EU regulation QR doubles as branded AI art — 25% higher scan rates than plain QR codes.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 items-start">
                  <Icon className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black uppercase text-white mb-1">{title}</p>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { stat: '< 3s', label: 'Blockchain anchor time' },
            { stat: '100%', label: 'QR scan guarantee' },
            { stat: '1.2M', label: 'Passports / day capacity' },
            { stat: 'EU 2024/1789', label: 'Regulation compliant' },
          ].map(({ stat, label }) => (
            <div key={label} className="protocol-card p-5 text-center">
              <p className="text-2xl font-black gold-text mb-1">{stat}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="gold-divider" />

      {/* ── COMPARISON TABLE ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="protocol-badge mb-6 inline-flex">
            <BarChart3 className="w-3 h-3" />
            Competitive Comparison
          </span>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mt-4 mb-6">
            AuthiChain vs <span className="gold-text">Enterprise Incumbents</span>
          </h2>
          <p className="max-w-xl mx-auto text-zinc-500 text-sm leading-relaxed">
            Scantrust, VeChain, and Circularise all require six-figure enterprise contracts
            and 3–6 month implementations. AuthiChain gives you EU DPP compliance today.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-zinc-600 border-b border-zinc-900 w-1/5">
                  Feature
                </th>
                {[
                  { name: 'AuthiChain', highlight: true },
                  { name: 'Scantrust', highlight: false },
                  { name: 'VeChain', highlight: false },
                  { name: 'Circularise', highlight: false },
                ].map(({ name, highlight }) => (
                  <th
                    key={name}
                    className={`p-4 text-[10px] font-black uppercase tracking-widest border-b border-zinc-900 text-center ${
                      highlight ? 'text-gold' : 'text-zinc-500'
                    }`}
                  >
                    {name}
                    {highlight && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-[8px] text-gold">
                        Best Value
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  feature: 'Starting Price',
                  authichain: '$49 / product',
                  scantrust: '$50K+ / year',
                  vechain: '$50K+ enterprise',
                  circularise: '$30K+ / year',
                },
                {
                  feature: 'Setup Time',
                  authichain: '5 minutes',
                  scantrust: '3–6 months',
                  vechain: '6–12 months',
                  circularise: '3–6 months',
                },
                {
                  feature: 'Blockchain',
                  authichain: 'Polygon (public)',
                  scantrust: 'None (centralized)',
                  vechain: 'VeChainThor',
                  circularise: 'Private chain',
                },
                {
                  feature: 'Public Verifiability',
                  authichain: 'Yes — any device',
                  scantrust: 'Vendor portal only',
                  vechain: 'VeChain Explorer',
                  circularise: 'Partner API only',
                },
                {
                  feature: 'AI Art QR Codes',
                  authichain: 'Yes — branded',
                  scantrust: 'No',
                  vechain: 'No',
                  circularise: 'No',
                },
                {
                  feature: 'EU DPP Export',
                  authichain: 'JSON + XML',
                  scantrust: 'JSON',
                  vechain: 'Custom',
                  circularise: 'JSON',
                },
                {
                  feature: 'Battery Passport 2027',
                  authichain: 'Ready now',
                  scantrust: 'In development',
                  vechain: 'Enterprise only',
                  circularise: 'In development',
                },
                {
                  feature: 'No Sales Call Needed',
                  authichain: 'Yes',
                  scantrust: 'No',
                  vechain: 'No',
                  circularise: 'No',
                },
              ].map(({ feature, authichain, scantrust, vechain, circularise }, i) => (
                <tr key={feature} className={i % 2 === 0 ? 'bg-zinc-950/40' : ''}>
                  <td className="p-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-900/50">
                    {feature}
                  </td>
                  <td className="p-4 text-center border-b border-zinc-900/50 border-l border-gold/10 bg-gold/5">
                    <span className="text-xs font-black text-gold">{authichain}</span>
                  </td>
                  <td className="p-4 text-center border-b border-zinc-900/50">
                    <span className="text-xs text-zinc-500">{scantrust}</span>
                  </td>
                  <td className="p-4 text-center border-b border-zinc-900/50">
                    <span className="text-xs text-zinc-500">{vechain}</span>
                  </td>
                  <td className="p-4 text-center border-b border-zinc-900/50">
                    <span className="text-xs text-zinc-500">{circularise}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="gold-divider" />

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20" id="pricing">
        <div className="text-center mb-16">
          <span className="protocol-badge mb-6 inline-flex">
            <CheckCircle className="w-3 h-3" />
            DPP Compliance Pricing
          </span>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mt-4 mb-6">
            Start Your <span className="gold-text">DPP Compliance</span> Today
          </h2>
          <p className="max-w-xl mx-auto text-zinc-500 text-sm leading-relaxed">
            All plans include blockchain anchoring, EU DPP data export, and AI art QR codes.
            Credits never expire. No contracts.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Basic */}
          <div className="protocol-card p-8 flex flex-col border-zinc-800 bg-zinc-950/50">
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-3">Single DPP</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white">$49</span>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">one-time</span>
              </div>
              <p className="text-xs text-zinc-600">1 EU digital product passport</p>
            </div>
            <ul className="space-y-3 mb-8 flex-grow text-xs text-zinc-500">
              {[
                '1 blockchain-anchored passport',
                'Serialized QR code product passport',
                'EU DPP JSON/XML export',
                'Ed25519 cryptographic signing',
                'Polygon network anchor',
                'AI art QR code included',
                'Public verifiability',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="https://buy.stripe.com/14A4gz9brgbQdOG4ba1Nu0w"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-gold w-full py-3 text-center font-black uppercase tracking-widest text-xs"
            >
              Get Single DPP
            </a>
          </div>

          {/* Brand Pack — highlighted */}
          <div className="protocol-card p-8 flex flex-col relative border-gold/40 bg-gold/5 shadow-[0_0_50px_rgba(201,162,39,0.08)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gold text-black px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Most Popular
            </div>
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3">Brand Pack</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white">$199</span>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">one-time</span>
              </div>
              <p className="text-xs text-zinc-600">5 passports · $40 each</p>
            </div>
            <ul className="space-y-3 mb-8 flex-grow text-xs text-zinc-400">
              {[
                '5 blockchain-anchored passports',
                'All Single DPP features',
                'Battery passport 2027 ready',
                'Supply chain traceability module',
                'Carbon footprint data fields',
                'Material composition tracking',
                'Priority email support',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="https://buy.stripe.com/aFabJ1cnD9Ns25Y7nm1Nu0A"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold w-full py-3 text-center font-black uppercase tracking-widest text-xs"
            >
              Get Brand Pack
            </a>
          </div>

          {/* Enterprise */}
          <div className="protocol-card p-8 flex flex-col border-zinc-800 bg-zinc-950/50">
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-3">Enterprise DPP</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white">$999</span>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">/mo</span>
              </div>
              <p className="text-xs text-zinc-600">Unlimited passports · Full API</p>
            </div>
            <ul className="space-y-3 mb-8 flex-grow text-xs text-zinc-500">
              {[
                'Unlimited product passports',
                'Full REST API access',
                'Bulk import & batch generation',
                'Custom blockchain data fields',
                'White-label QR code output',
                'EU Central Registry API integration',
                'Dedicated support SLA',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="https://buy.stripe.com/aFaaEX9br4t8dOG8rq1Nu0y"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-gold w-full py-3 text-center font-black uppercase tracking-widest text-xs"
            >
              Get Enterprise
            </a>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-700 uppercase tracking-widest mt-8">
          All plans · Blockchain anchored · EU DPP compliant · No contracts · Credits never expire
        </p>
      </section>

      <div className="gold-divider" />

      {/* ── COMPLIANCE TIMELINE ──────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="flex items-center gap-4 mb-12">
          <div className="h-px flex-1 bg-zinc-900" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 whitespace-nowrap">
            EU DPP Compliance Timeline
          </h2>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        <div className="space-y-4">
          {[
            {
              date: 'July 19, 2026',
              label: 'EU Central DPP Registry Opens',
              sublabel: 'First products must be registered.',
              active: true,
            },
            {
              date: 'February 2027',
              label: 'Battery Passports Mandatory',
              sublabel: 'All EV and industrial batteries sold in EU require a compliant battery passport.',
              active: false,
            },
            {
              date: '2028',
              label: 'Textiles & Electronics',
              sublabel: 'Digital product passport EU regulation extends to clothing and electronics sectors.',
              active: false,
            },
            {
              date: '2030',
              label: 'All EU Physical Goods',
              sublabel: 'Full mandate — every physical product sold in EU requires DPP compliance.',
              active: false,
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`protocol-card p-6 flex justify-between items-start gap-4 ${
                item.active ? 'bg-gold/5 border-gold/20' : 'opacity-60'
              }`}
            >
              <div className="flex items-start gap-6 flex-1">
                <span
                  className={`text-sm font-black uppercase tracking-widest shrink-0 w-36 ${
                    item.active ? 'text-gold' : 'text-zinc-600'
                  }`}
                >
                  {item.date}
                </span>
                <div>
                  <p className="text-sm font-black text-white uppercase mb-1">{item.label}</p>
                  <p className="text-xs text-zinc-600">{item.sublabel}</p>
                </div>
              </div>
              {item.active && (
                <div className="shrink-0 flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Urgent
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="gold-divider" />

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="bg-zinc-950 border-y border-zinc-900 py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="protocol-badge mb-8 inline-flex">
            <Zap className="w-3 h-3" />
            Act Before July 19, 2026
          </span>
          <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tighter leading-none">
            Start Your DPP Compliance <br />
            <span className="gold-text">Today</span>
          </h2>
          <p className="text-zinc-500 mb-4 text-sm leading-relaxed max-w-xl mx-auto">
            The EU Digital Product Passport registry opens in {daysLeft} days.
            AuthiChain gets you compliant in under 5 minutes — from $49, no sales call, no contract.
          </p>
          <p className="text-zinc-700 text-xs uppercase tracking-widest mb-12">
            Blockchain product authentication · QR code product passport · Battery passport 2027 ready
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://buy.stripe.com/aFabJ1cnD9Ns25Y7nm1Nu0A"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold px-10 py-4 font-black uppercase tracking-widest text-xs inline-flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Get Brand Pack — $199
            </a>
            <Link
              href="/"
              className="btn-outline-gold px-10 py-4 font-black uppercase tracking-widest text-xs inline-flex items-center justify-center gap-2"
            >
              Explore Full Platform
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-black uppercase tracking-tighter text-center mb-12">
          <span className="gold-text">DPP Compliance FAQ</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              q: 'What is an EU Digital Product Passport?',
              a: 'A DPP is a mandatory digital record for physical products sold in the EU, containing material composition, carbon footprint, supply chain data, and a serialized QR code — required under EU Regulation 2024/1789.',
            },
            {
              q: 'When does the EU DPP mandate start?',
              a: 'The EU Central DPP Registry opens July 19, 2026. Battery passports become mandatory February 2027. Full mandate for all physical goods hits in 2030.',
            },
            {
              q: 'Does AuthiChain meet EU DPP requirements?',
              a: 'Yes. AuthiChain generates serialized QR codes, blockchain-anchored product records, and EU-compliant JSON/XML data exports covering all required DPP fields.',
            },
            {
              q: 'How is this different from Scantrust or VeChain?',
              a: 'Scantrust and VeChain require $50K+ enterprise contracts and 3–6 month implementations. AuthiChain starts at $49 per product with 5-minute setup and public blockchain verifiability.',
            },
            {
              q: 'Is my blockchain product passport publicly verifiable?',
              a: 'Yes. Every DPP record is anchored on the Polygon public blockchain, meaning EU regulators, customs officials, and consumers can all verify authenticity without a vendor portal.',
            },
            {
              q: 'What is a battery passport?',
              a: 'A battery passport is a mandatory DPP for EV and industrial batteries, required by February 2027 in the EU. It must include state of health, capacity, cycle count, carbon footprint, and recycled material percentage.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="protocol-card p-5">
              <p className="font-semibold text-sm mb-2 text-zinc-200">{q}</p>
              <p className="text-xs text-zinc-600 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 opacity-50 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            &copy; 2026 AuthiChain Protocol &mdash; EU DPP Compliance Division
          </p>
          <div className="flex gap-6 flex-wrap justify-center">
            <Link href="/digital-product-passport" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">
              DPP Overview
            </Link>
            <Link href="/pricing" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">
              Pricing
            </Link>
            <Link href="/docs" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">
              API Docs
            </Link>
            <span className="text-zinc-800">|</span>
            <Link href="/terms" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">
              Privacy
            </Link>
            <Link href="/" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
