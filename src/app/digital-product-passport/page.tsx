import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  BarChart3,
  Leaf,
  Hammer,
  Truck,
  Recycle,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DPPHero } from './_components/DPPHero';

export const metadata: Metadata = {
  title: 'Digital Product Passport | AuthiChain',
  description:
    'AuthiChain industrial Digital Product Passport platform — blockchain-anchored, EU 2024/1789 compliant. Battery passports, supply chain traceability, and AI art QR codes.',
  alternates: {
    canonical: '/digital-product-passport',
  },
  openGraph: {
    title: 'Digital Product Passport | AuthiChain',
    description:
      'Industrial-grade EU DPP compliance. Blockchain-anchored product passports, serialized QR codes, and battery passport 2027 readiness.',
    siteName: 'AuthiChain',
    images: [
      {
        url: '/media/samples/03_flux_authichain.png',
        width: 1200,
        height: 630,
        alt: 'AuthiChain Digital Product Passport',
      },
    ],
  },
};

export default function DPPPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Hero — client component (contains interactive demo) */}
      <DPPHero />

      {/* Compliance Timeline */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-12">
          <div className="h-px flex-1 bg-zinc-900" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Compliance Timeline</h2>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        <div className="space-y-4">
          {[
            { date: 'July 2026', label: 'Central DPP Registry Opens', active: true },
            { date: 'Feb 2027', label: 'Battery Passport Mandatory (EV, Industrial)', active: false },
            { date: '2028', label: 'Textiles & Electronics Delegation', active: false },
            { date: '2030', label: 'Mandatory for All EU Physical Goods', active: false },
          ].map((item, i) => (
            <div
              key={i}
              className={`protocol-card p-6 flex justify-between items-center ${
                item.active ? 'bg-gold/5 border-gold/20' : 'opacity-50'
              }`}
            >
              <div className="flex items-center gap-6">
                <span className={`text-sm font-black uppercase tracking-widest ${
                  item.active ? 'text-gold' : 'text-zinc-600'
                }`}>
                  {item.date}
                </span>
                <span className="text-sm font-bold text-zinc-300 uppercase">{item.label}</span>
              </div>
              {item.active && <Sparkles className="w-4 h-4 text-gold animate-pulse" />}
            </div>
          ))}
        </div>
      </section>

      {/* Industrial Capabilities Grid */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-black uppercase tracking-tight text-center mb-16">
          Enterprise <span className="gold-text">Protocol</span> Requirements
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: BarChart3,
              title: 'Unique Identity',
              desc: 'Serialized identifiers for every unit, linked to an immutable blockchain record.',
            },
            {
              icon: Leaf,
              title: 'Carbon Footprint',
              desc: 'Lifecycle emissions data from raw materials through manufacturing and transport.',
            },
            {
              icon: Recycle,
              title: 'Material Composition',
              desc: 'Full bill of materials (BOM), recycled content, and hazardous substance declarations.',
            },
            {
              icon: Hammer,
              title: 'Repairability',
              desc: 'Digital repair manuals, spare parts availability, and expected product lifetime.',
            },
            {
              icon: Truck,
              title: 'Supply Chain',
              desc: 'Auditable chain of custody from source to shelf, anchored on the Polygon network.',
            },
            {
              icon: Leaf,
              title: 'Seed to Sale',
              desc: 'Specialized provenance for agriculture and high-value strains, tracking every batch and harvest.',
            },
            {
              icon: ShieldCheck,
              title: 'Regulatory Export',
              desc: 'Instant generation of EU-compliant JSON/XML data formats for registry submission.',
            },
            {
              icon: Zap,
              title: 'Real-Time Throughput',
              desc: 'Sub-second response times for query and verification operations at industrial scale — engineered for 1M+ daily anchors.',
            },
          ].map((item, i) => (
            <div key={i} className="protocol-card p-8 group hover:border-gold/40 transition-all">
              <item.icon className="w-8 h-8 text-gold mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-black uppercase tracking-tight mb-3">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-zinc-950 border-y border-zinc-900 py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-black mb-8 uppercase tracking-tighter leading-none">
            Scale Your <span className="gold-text">Compliance</span> <br />
            With Our Industrial API
          </h2>
          <p className="text-zinc-500 mb-12 uppercase tracking-widest text-xs font-bold">
            Programmatic generation for 1M+ units per day.
          </p>
          <Link
            href="/dashboard"
            className="btn-gold inline-flex items-center gap-3 px-10 py-4 font-black uppercase tracking-widest text-xs shadow-gold"
          >
            API Documentation <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer Navigation */}
      <footer className="py-12 px-6 border-t border-zinc-900 mt-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            &copy; 2026 AuthiChain Protocol — Industrial Division
          </p>
          <div className="flex gap-6 flex-wrap justify-center">
            <Link href="/digital-product-passport/compliance" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Compliance</Link>
            <Link href="/digital-product-passport/hardware" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Hardware</Link>
            <Link href="/digital-product-passport/partners" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Partners</Link>
            <span className="text-zinc-800">|</span>
            <Link href="/terms" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Terms</Link>
            <Link href="/privacy" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Privacy</Link>
            <Link href="/gallery" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Gallery</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
