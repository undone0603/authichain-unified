'use client';

import Link from 'next/link';
import { LeadCaptureForm } from '@/components/lead-capture-form';
import {
  Leaf, Shield, Package, MapPin, Activity, Zap,
  ArrowRight, CheckCircle, Dna, AlertTriangle, Lock,
  BarChart3, Truck, ScanLine,
} from 'lucide-react';

const GREEN = '#10b981';
const AMBER = '#d97706';

const STATS = [
  { value: '23', label: 'States Compliant' },
  { value: '< 2s', label: 'Verification Time' },
  { value: 'Metrc', label: 'Integration Ready' },
  { value: '100%', label: 'Audit Trail Coverage' },
];

const STEPS = [
  { n: '01', icon: Dna, title: 'Register Your Strain', desc: 'Submit genetic fingerprint, cultivar data, and licensing documents. Each strain receives a unique GeneticID anchored on Polygon.', color: GREEN },
  { n: '02', icon: ScanLine, title: 'Generate StrainChain QRON', desc: 'AI-generated art QR codes embed your strain identity cryptographically. Affixed to packaging, pods, or labels at point of production.', color: '#8b5cf6' },
  { n: '03', icon: Truck, title: 'Track Every Handoff', desc: 'Each scan creates an immutable ledger entry — transfer of custody, location, temperature deviation, and timestamp recorded on-chain.', color: AMBER },
  { n: '04', icon: Shield, title: 'Verify at Point of Sale', desc: 'Consumers, inspectors, and dispensaries scan the QRON. The AuthiChain protocol confirms authenticity and full chain of custody in < 2s.', color: GREEN },
];

const FEATURES = [
  { icon: Dna, title: 'Genetic Mapping', desc: 'Terpene profile and cannabinoid fingerprinting linked to each batch. Prove genetic lineage from mother plant to final product.', color: GREEN },
  { icon: MapPin, title: 'Geo-Fence Watchdog', desc: 'Real-time alerts when a QRON scan occurs outside permitted geographic zones. Instantly flag diversion or grey-market activity.', color: '#ef4444' },
  { icon: AlertTriangle, title: 'Compliance Watchdog', desc: 'Continuous monitoring against state-specific THC limits, packaging requirements, and lab testing expiry dates.', color: AMBER },
  { icon: Activity, title: 'Metrc Integration', desc: 'Bidirectional sync with Metrc (CCTT) state tracking systems. One scan updates both StrainChain and state inventory simultaneously.', color: '#3b82f6' },
  { icon: BarChart3, title: 'Chain-of-Custody Analytics', desc: 'Dashboard of every scan — who, when, where. Export compliance-ready audit reports in Metrc, state, or CSV format.', color: '#8b5cf6' },
  { icon: Lock, title: 'Immutable Lab Results', desc: 'COA (Certificate of Analysis) PDFs are hashed and anchored on-chain at the time of upload. No retroactive modification possible.', color: GREEN },
];

const PLANS = [
  {
    name: 'Basic', price: '$199', period: '/mo',
    features: ['500 strain registrations/mo', 'QR generation + Metrc sync', 'Standard geo-fence alerts', 'Compliance dashboard', 'Email support'],
    cta: 'Start Basic',
    highlighted: false,
  },
  {
    name: 'Pro', price: '$499', period: '/mo',
    features: ['2,500 strain registrations/mo', 'Genetic mapping module', 'Real-time Watchdog alerts', 'Multi-license management', 'Webhook API + priority support'],
    cta: 'Start Pro',
    highlighted: true,
  },
  {
    name: 'Enterprise', price: '$999', period: '/mo',
    features: ['Unlimited registrations', 'Custom AI model training', 'On-chain product narratives', '24/7 dedicated support', 'White-label portal option'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const STATES = [
  'CA', 'CO', 'IL', 'MI', 'NV', 'OR', 'WA', 'AZ', 'MA', 'NY',
  'NJ', 'MN', 'MD', 'CT', 'NM',
];

export default function StrainChainHome() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Leaf className="w-6 h-6" style={{ color: GREEN }} />
          <span className="font-black text-xl tracking-tighter">StrainChain</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">.io</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {[['How It Works', '#how-it-works'], ['Features', '#features'], ['Pricing', '#pricing'], ['Demo', '/demo/strainchain']].map(([label, href]) => (
            <a key={label} href={href} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-emerald-400 transition-colors">{label}</a>
          ))}
        </div>
        <Link href="/demo/strainchain" className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg border text-emerald-400 hover:bg-emerald-500/10 transition-all" style={{ borderColor: `${GREEN}40` }}>
          Try Demo
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6">

        {/* Hero */}
        <section className="py-24 text-center relative">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${GREEN}08 0%, transparent 70%)` }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest mb-8" style={{ borderColor: `${GREEN}30`, background: `${GREEN}08`, color: GREEN }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
              Watchdog Active · 23 States · Metrc Integrated
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
              From Seed to Sale.<br />
              <span style={{ background: `linear-gradient(135deg, ${GREEN} 0%, #582f0e 50%, #064e3b 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Every Gram. On Chain.
              </span>
            </h1>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              Real-time supply chain compliance for cannabis operators and AgTech companies. Genetic mapping, geo-fencing, and Metrc sync — all in one scannable QR code.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/enterprise" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${GREEN} 0%, #064e3b 100%)` }}>
                <Leaf className="w-4 h-4" /> Start Tracking Free
              </Link>
              <Link href="/demo/strainchain" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest border hover:bg-emerald-500/10 transition-all flex items-center gap-2" style={{ borderColor: `${GREEN}30`, color: GREEN }}>
                <ScanLine className="w-4 h-4" /> Live Demo
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
          {STATS.map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center">
              <div className="text-3xl font-black mb-1" style={{ color: GREEN }}>{value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</div>
            </div>
          ))}
        </div>

        {/* The Compliance Problem */}
        <section className="mb-24 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block mb-4">The Stakes</span>
              <h2 className="text-4xl font-black tracking-tighter mb-6">
                One compliance failure costs <span style={{ color: '#ef4444' }}>$50K+</span> in fines. And your license.
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                State regulators are tightening seed-to-sale requirements every quarter. Manual Metrc entries, paper COAs, and spreadsheet tracking leave you exposed to audit gaps, diversion allegations, and product recalls.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                StrainChain automates the entire compliance chain — from genetic registration at cultivation to verified scan at point of sale — with an immutable on-chain audit trail that satisfies any regulator.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Manual Metrc entry accuracy', pct: 71, color: '#ef4444' },
                { label: 'Paper COA tamper resistance', pct: 40, color: '#f97316' },
                { label: 'StrainChain compliance coverage', pct: 100, color: GREEN },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs font-black mb-2">
                    <span className="text-zinc-400 uppercase tracking-widest">{label}</span>
                    <span style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-900">
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-24" id="how-it-works">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: GREEN }}>Supply Chain Flow</span>
            <h2 className="text-4xl font-black tracking-tighter">How StrainChain Works</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, title, desc, icon: Icon, color }) => (
              <div key={n} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-black font-mono" style={{ color }}>{n}</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-24" id="features">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: GREEN }}>Platform Features</span>
            <h2 className="text-4xl font-black tracking-tighter">Everything Compliance Requires</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 hover:border-zinc-700 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-2">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* State Compliance Map */}
        <section className="mb-24 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-12">
          <div className="text-center mb-10">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: GREEN }}>Regulatory Coverage</span>
            <h2 className="text-3xl font-black tracking-tighter">23 States. 100% Audit Trail.</h2>
            <p className="text-zinc-500 text-sm mt-3 max-w-lg mx-auto">StrainChain is pre-configured for each state&apos;s Metrc API endpoints, packaging requirements, and THC limits.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {STATES.map((state) => (
              <div key={state} className="px-4 py-2 rounded-xl border font-black text-xs flex items-center gap-2" style={{ borderColor: `${GREEN}30`, background: `${GREEN}08`, color: GREEN }}>
                <CheckCircle className="w-3 h-3" /> {state}
              </div>
            ))}
            <div className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 font-black text-xs text-zinc-600 flex items-center gap-2">
              + more soon
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-24" id="pricing">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: GREEN }}>Pricing</span>
            <h2 className="text-4xl font-black tracking-tighter">Simple. Operator-Friendly.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map(({ name, price, period, features, cta, highlighted }) => (
              <div key={name} className={`rounded-2xl p-8 flex flex-col border ${highlighted ? 'ring-1' : ''}`}
                style={{
                  borderColor: highlighted ? GREEN : '#27272a',
                  background: highlighted ? `linear-gradient(135deg, ${GREEN}08 0%, #0a0a0a 100%)` : 'rgba(9,9,11,0.6)',
                  ...(highlighted ? { boxShadow: `0 0 0 1px ${GREEN}` } : {}),
                }}>
                {highlighted && (
                  <div className="text-center mb-4">
                    <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}40` }}>
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-black text-center mb-1">{name}</h3>
                <div className="text-center mb-6">
                  <span className="text-4xl font-black" style={{ color: GREEN }}>{price}</span>
                  <span className="text-zinc-600 text-sm">{period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-zinc-400">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GREEN }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all"
                  style={highlighted
                    ? { background: `linear-gradient(135deg, ${GREEN} 0%, #064e3b 100%)`, color: '#fff' }
                    : { border: `1px solid ${GREEN}40`, color: GREEN, background: 'transparent' }
                  }>
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Lead Capture */}
        <section className="mb-24">
          <LeadCaptureForm
            domain="strainchain"
            headline="Track Your Supply Chain"
            subheadline="Complete provenance tracking with GPS, compliance, and blockchain audit trail."
            cta="Start Free"
          />
        </section>

        {/* CTA */}
        <section className="mb-24 rounded-3xl text-center py-20 px-8 relative overflow-hidden border" style={{ borderColor: `${GREEN}20`, background: 'linear-gradient(135deg, #020f08 0%, #0a0a0a 50%, #020f08 100%)' }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${GREEN}08 0%, transparent 60%)` }} />
          <div className="relative z-10">
            <Leaf className="w-12 h-12 mx-auto mb-6" style={{ color: GREEN }} />
            <h2 className="text-4xl font-black tracking-tighter mb-4">Start Your First Strain Registration Free</h2>
            <p className="text-zinc-400 mb-10 max-w-md mx-auto">No credit card. 10 complimentary registrations. Metrc sync included. See the full chain of custody in under 5 minutes.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/enterprise" className="px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white inline-flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${GREEN} 0%, #064e3b 100%)` }}>
                <Leaf className="w-4 h-4" /> Start Free
              </Link>
              <Link href="/demo/strainchain" className="px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest border hover:bg-emerald-500/10 transition-all flex items-center gap-2" style={{ borderColor: `${GREEN}30`, color: GREEN }}>
                Watch Demo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Ecosystem */}
        <section className="mb-16">
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-700 mb-8">The AuthiChain Ecosystem</p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'AuthiChain.com', desc: 'Enterprise Auth Protocol', url: 'https://authichain.com', color: '#c9a227' },
              { name: 'QRON.space', desc: 'AI QR Art Studio', url: 'https://qron.space', color: '#8b5cf6' },
              { name: 'GovChain.us', desc: 'DAO Governance', url: 'https://govchain.us', color: '#3b82f6' },
            ].map(({ name, desc, url, color }) => (
              <a key={name} href={url} className="px-5 py-3 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors bg-zinc-950 flex flex-col items-start gap-0.5">
                <span className="text-xs font-black" style={{ color }}>{name}</span>
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{desc}</span>
              </a>
            ))}
          </div>
        </section>

        <footer className="text-center py-10 border-t border-zinc-900">
          <div className="flex justify-center gap-6 mb-4">
            {[['Terms', '/terms'], ['Privacy', '/privacy'], ['Compliance', '/digital-product-passport/compliance'], ['Status', '/status']].map(([label, href]) => (
              <Link key={label} href={href} className="text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">{label}</Link>
            ))}
          </div>
          <p className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">
            StrainChain.io · AuthiChain Protocol · Metrc Integrated · © 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
