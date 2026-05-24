'use client';

import { Shield, Server, Zap, Globe, Layers, BarChart3, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black font-sans">
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden border-b border-zinc-900">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-gold/5 blur-[120px] rounded-full opacity-30" />
        
        <div className="max-w-6xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            <Shield className="w-4 h-4 text-gold" />
            Industrial Scale Authentication
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter uppercase leading-[0.85]">
            QRON For <br />
            <span className="gold-text">Enterprise</span>
          </h1>
          
          <p className="max-w-3xl mx-auto text-zinc-500 text-lg md:text-xl font-medium mb-12 leading-relaxed uppercase tracking-tighter">
            Government-grade cryptographic security, multi-region edge delivery, and 
            immutable supply chain provenance for the world&apos;s most demanding brands.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/login" className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold">
              Contact Solutions
            </Link>
            <Link href="/authichain" className="btn-outline-gold px-12 py-5 font-black uppercase tracking-widest text-xs border-zinc-800">
              Protocol Technicals
            </Link>
          </div>
        </div>
      </section>

      {/* Industrial Capabilities */}
      <section className="max-w-7xl mx-auto px-6 py-32">
        <div className="grid md:grid-cols-2 gap-24 items-center">
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tight mb-8 leading-none">
              Infrastructure <br />
              <span className="text-zinc-600">Built for Scale.</span>
            </h2>
            <div className="space-y-10">
              {[
                { 
                  title: 'Global Edge Fleet', 
                  desc: '12ms global redirect latency through our distributed network of edge workers.',
                  icon: Globe 
                },
                { 
                  title: 'Industrial Webhooks', 
                  desc: 'Real-time event streaming for ERP and supply chain management integrations.',
                  icon: Zap 
                },
                { 
                  title: 'Cryptographic Sovereignty', 
                  desc: 'Every asset signed with hardware-backed Ed25519 keys for non-repudiation.',
                  icon: Shield 
                }
              ].map(feat => (
                <div key={feat.title} className="flex gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-900 flex items-center justify-center shrink-0 text-gold">
                    <feat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-tight text-white mb-2">{feat.title}</h4>
                    <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="protocol-card p-8 bg-zinc-950/50">
                <BarChart3 className="w-8 h-8 text-gold mb-6" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Throughput</h4>
                <p className="text-2xl font-black text-white">50k+</p>
                <p className="text-[9px] font-bold text-zinc-700 uppercase">Requests / Sec</p>
             </div>
             <div className="protocol-card p-8 bg-zinc-950/50 mt-8">
                <Server className="w-8 h-8 text-gold mb-6" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Availability</h4>
                <p className="text-2xl font-black text-white">99.99%</p>
                <p className="text-[9px] font-bold text-zinc-700 uppercase">Contractual SLA</p>
             </div>
             <div className="protocol-card p-8 bg-zinc-950/50 -mt-8">
                <Shield className="w-8 h-8 text-gold mb-6" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Compliance</h4>
                <p className="text-2xl font-black text-white">DPP v2</p>
                <p className="text-[9px] font-bold text-zinc-700 uppercase">Industrial Standard</p>
             </div>
             <div className="protocol-card p-8 bg-zinc-950/50">
                <Layers className="w-8 h-8 text-gold mb-6" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Integration</h4>
                <p className="text-2xl font-black text-white">SAP/CRM</p>
                <p className="text-[9px] font-bold text-zinc-700 uppercase">Native Bridge</p>
             </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="bg-zinc-950 py-32 px-6 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-black uppercase tracking-tight mb-8">Ready to secure your industrial assets?</h3>
            <button className="btn-gold px-16 py-6 rounded-xl font-black uppercase tracking-[0.2em] text-sm shadow-gold group">
                Request Pilot Access <ArrowRight className="inline-block ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </section>

      <footer className="py-20 border-t border-zinc-900 bg-black px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
              <div className="flex items-center gap-2 text-white font-black text-xl tracking-tighter uppercase">
                  <Shield className="w-6 h-6 text-gold" />
                  AuthiChain Enterprise
              </div>
              <div className="flex gap-12 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  <Link href="/status" className="hover:text-gold transition-colors">Status</Link>
                  <Link href="/explorers" className="hover:text-gold transition-colors">Explorers</Link>
                  <Link href="/legal" className="hover:text-gold transition-colors">Legal</Link>
                  <Link href="/docs" className="hover:text-gold transition-colors">Docs</Link>
              </div>
          </div>
      </footer>
    </div>
  );
}
