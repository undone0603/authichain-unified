import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Printer,
  Code,
  DollarSign,
  ArrowRight,
  Layers,
  Zap,
  Globe
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'White-Label SDK | AuthiChain Protocol for Print Shops',
  description: 'Embed the AuthiChain verification protocol directly into your label printing workflow. Turn static packaging into scannable, blockchain-anchored digital assets.',
};

export default function WhiteLabelPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-500/5 blur-[120px] rounded-full opacity-50 pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
            <Printer className="w-4 h-4" />
            Channel Partner Program: Print & Packaging
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase leading-[0.9]">
            YOUR LABELS. <br />
            <span className="text-blue-400">OUR PROTOCOL.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-zinc-400 text-lg md:text-xl font-medium mb-12 leading-relaxed">
            Upgrade your print shop offerings overnight. Integrate the AuthiChain White-Label SDK to generate AI-powered, blockchain-anchored QR codes for your clients directly from your existing dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors">
              Become a Reseller ($299/mo)
            </Link>
            <Link href="/docs" className="btn-outline-gold border-zinc-800 text-zinc-300 px-12 py-5 font-black uppercase tracking-widest text-xs">
              View API Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: Code, 
              title: 'Drop-In SDK', 
              desc: 'Integrate our REST API into your print management software in hours. Generate unique Ed25519-signed QRONs in bulk.' 
            },
            { 
              icon: Layers, 
              title: '10 Verticals, 1 SDK', 
              desc: 'From "Made in USA" compliance to Luxury Authentication, sell specialized verification templates without changing your infrastructure.' 
            },
            {
              icon: DollarSign,
              title: 'New Revenue Streams',
              desc: 'Charge your clients a premium for "Smart Labels." You pay fractions of a cent per scan, you keep the margin.'
            },
            {
              icon: ShieldCheck,
              title: 'Compliance Built-In',
              desc: 'Ed25519 signatures and Polygon anchors give your clients audit-ready proof for FTC MUSA, EU DPP, and ISO traceability claims.'
            },
            {
              icon: Zap,
              title: 'Sub-Second Generation',
              desc: 'Edge-optimized rendering pipeline returns a verified QRON image in under 800ms per asset, even under bulk reseller load.'
            },
            {
              icon: Globe,
              title: 'Global Anchor Network',
              desc: 'Every QRON you mint resolves through our multi-region verification network, so end customers scan and verify from anywhere.'
            },
          ].map((item, i) => (
            <div key={i} className="protocol-card p-8 group hover:border-blue-500/30 transition-all border-zinc-900 bg-zinc-950/50">
              <item.icon className="w-8 h-8 text-blue-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-black uppercase tracking-tight mb-3 text-white">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Target Partners */}
      <section className="py-24 bg-zinc-950 border-y border-zinc-900">
          <div className="max-w-6xl mx-auto px-6 text-center">
              <h2 className="text-2xl font-black uppercase tracking-widest text-zinc-400 mb-12">Built for high-volume commercial printers</h2>
              <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale">
                  <div className="text-xl font-black uppercase tracking-tighter">FASTSIGNS</div>
                  <div className="text-xl font-black uppercase tracking-tighter">Signarama</div>
                  <div className="text-xl font-black uppercase tracking-tighter">MOO</div>
                  <div className="text-xl font-black uppercase tracking-tighter">4imprint</div>
              </div>
          </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-black mb-8 uppercase tracking-tighter leading-none">
            Ready to upgrade your <br /> <span className="text-blue-400">Print Fleet?</span>
          </h2>
          <p className="text-zinc-500 mb-12 uppercase tracking-widest text-xs font-bold">
            Full white-label schema deployed. Custom domains, logos, and API prefixes included.
          </p>
          <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-3 px-10 py-4 font-black uppercase tracking-widest text-xs rounded-xl transition-colors">
            Start Reselling Today <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto text-center opacity-40">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            &copy; 2026 AuthiChain Protocol ◆ Channel Partner Operations
          </p>
        </div>
      </footer>
    </div>
  );
}
