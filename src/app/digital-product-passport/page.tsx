'use client';

import { useState } from 'react';
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
  Lock,
  Activity,
  CheckCircle,
  Database
} from 'lucide-react';

export default function DPPPage() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);

  const startDemo = () => {
    setIsSimulating(true);
    setSimStep(1);
    setTimeout(() => setSimStep(2), 1500);
    setTimeout(() => setSimStep(3), 3000);
    setTimeout(() => {
      setIsSimulating(false);
      setSimStep(4);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gold/5 blur-[120px] rounded-full opacity-50" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-[0.2em] mb-8">
            <ShieldCheck className="w-4 h-4" />
            StrainChain.io — Industrial Provenance
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase leading-[0.9]">
            The Standard For <br />
            <span className="gold-text">Industrial</span> Passports
          </h1>
          
          <p className="max-w-2xl mx-auto text-zinc-500 text-lg md:text-xl font-medium mb-12 leading-relaxed">
            The EU Digital Product Passport (DPP) registry opens July 2026. 
            QRON provides the cryptographically-signed data carrier required for compliance, 
            wrapped in world-class AI art.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
                onClick={startDemo}
                disabled={isSimulating}
                className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold"
            >
              {isSimulating ? 'Processing Compliance...' : 'Simulate BMW Battery Passport'}
            </button>
            <Link href="/elite" className="btn-outline-gold px-12 py-5 font-black uppercase tracking-widest text-xs border-zinc-800">
              Join Elite Waitlist
            </Link>
          </div>

          {/* New Trust Row */}
          <div className="mt-20 flex flex-col items-center">
             <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-[0.4em] text-zinc-700 mb-8">
                <span>Polygon Anchored</span>
                <div className="w-1 h-1 rounded-full bg-zinc-800" />
                <span>Ed25519 Secured</span>
                <div className="w-1 h-1 rounded-full bg-zinc-800" />
                <span>EU 2024/1789 Compliant</span>
             </div>
             <div className="px-10 py-5 rounded-3xl bg-zinc-950 border border-zinc-900 inline-flex items-center gap-10">
                <div className="text-left border-r border-zinc-900 pr-10">
                    <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-1">Network Capacity</p>
                    <p className="text-2xl font-black text-white tracking-tighter">1.2M <span className="text-zinc-600 font-medium text-xs tracking-normal uppercase ml-1">Assets / Day</span></p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                   <Activity className="w-4 h-4 text-gold animate-pulse" />
                   Status: Industrial Ready
                </div>
             </div>
          </div>
        </div>

        {/* Demo Overlay */}
        {(isSimulating || simStep === 4) && (
            <div className="max-w-4xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="protocol-card p-10 bg-zinc-950 border-gold/20 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">BMW-BAT-992-X <span className="text-gold italic ml-2">PASSPORT</span></h3>
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Type: Industrial High-Voltage Battery • Series: M-Edition</p>
                        </div>
                        {simStep === 4 && (
                            <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" /> Compliance Verified
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 opacity-60">
                                <Activity className={`w-4 h-4 ${simStep >= 1 ? 'text-gold' : 'text-zinc-700'}`} />
                                <span className={`text-[10px] font-black uppercase ${simStep >= 1 ? 'text-white' : 'text-zinc-800'}`}>1. Environmental Ingest</span>
                            </div>
                            <div className="flex items-center gap-3 opacity-60">
                                <Database className={`w-4 h-4 ${simStep >= 2 ? 'text-gold' : 'text-zinc-700'}`} />
                                <span className={`text-[10px] font-black uppercase ${simStep >= 2 ? 'text-white' : 'text-zinc-800'}`}>2. State Hash Compute</span>
                            </div>
                            <div className="flex items-center gap-3 opacity-60">
                                <Lock className={`w-4 h-4 ${simStep >= 3 ? 'text-gold' : 'text-zinc-700'}`} />
                                <span className={`text-[10px] font-black uppercase ${simStep >= 3 ? 'text-white' : 'text-zinc-800'}`}>3. Polygon Anchor</span>
                            </div>
                        </div>

                        <div className="md:col-span-2 bg-black rounded-2xl p-6 font-mono text-[10px] leading-loose border border-zinc-900">
                             {simStep >= 1 && <p className="text-zinc-500">&gt; FETCHING METRICS: Capacity=84Ah, Health=99.2%, Cycles=12</p>}
                             {simStep >= 2 && <p className="text-zinc-400">&gt; GENERATING STATE HASH: 0x7a2d...8c9d</p>}
                             {simStep >= 3 && <p className="text-gold">&gt; ANCHORING SUCCESSFUL: BLOCK #4,102,884</p>}
                             {simStep === 4 && <p className="text-green-500">&gt; PROTOCOL HANDSHAKE COMPLETE. DPP ACTIVE.</p>}
                             {!isSimulating && simStep === 0 && <p className="text-zinc-800 italic animate-pulse">Waiting for simulation trigger...</p>}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </section>

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
            <div key={i} className={`protocol-card p-6 flex justify-between items-center ${item.active ? 'bg-gold/5 border-gold/20' : 'opacity-50'}`}>
              <div className="flex items-center gap-6">
                <span className={`text-sm font-black uppercase tracking-widest ${item.active ? 'text-gold' : 'text-zinc-600'}`}>
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
              desc: 'Serialized identifiers for every unit, linked to an immutable blockchain record.' 
            },
            { 
              icon: Leaf, 
              title: 'Carbon Footprint', 
              desc: 'Lifecycle emissions data from raw materials through manufacturing and transport.' 
            },
            { 
              icon: Recycle, 
              title: 'Material Composition', 
              desc: 'Full bill of materials (BOM), recycled content, and hazardous substance declarations.' 
            },
            { 
              icon: Hammer, 
              title: 'Repairability', 
              desc: 'Digital repair manuals, spare parts availability, and expected product lifetime.' 
            },
            { 
              icon: Truck, 
              title: 'Supply Chain', 
              desc: 'Auditable chain of custody from source to shelf, anchored on the Polygon network.' 
            },
            { 
              icon: Leaf, 
              title: 'Seed to Sale', 
              desc: 'Specialized provenance for agriculture and high-value strains, tracking every batch and harvest.' 
            },
            {
              icon: ShieldCheck,
              title: 'Regulatory Export',
              desc: 'Instant generation of EU-compliant JSON/XML data formats for registry submission.'
            },
            {
              icon: Zap,
              title: 'Real-Time Throughput',
              desc: 'Sub-second response times for query and verification operations at industrial scale — engineered for 1M+ daily anchors.'
            },
          ].map((item, i) => (
            <div key={i} className="protocol-card p-8 group hover:border-gold/40 transition-all">
              <item.icon className="w-8 h-8 text-gold mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-black uppercase tracking-tight mb-3">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">
                {item.desc}
              </p>
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
          <Link href="/dashboard" className="btn-gold inline-flex items-center gap-3 px-10 py-4 font-black uppercase tracking-widest text-xs shadow-gold">
            API Documentation <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer Navigation */}
      <footer className="py-12 px-6 border-t border-zinc-900 mt-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            &copy; 2026 AuthiChain Protocol ◆ Industrial Division
          </p>
          <div className="flex gap-6 flex-wrap justify-center">
             <Link href="/compliance" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Compliance</Link>
             <Link href="/hardware" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Hardware</Link>
             <Link href="/partners" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold transition-colors">Partners</Link>
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
