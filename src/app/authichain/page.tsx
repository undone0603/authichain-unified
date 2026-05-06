'use client';

import Link from 'next/link';
import { 
  Shield, 
  Server, 
  Database, 
  Lock, 
  Zap, 
  Globe, 
  ArrowRight,
  Code
} from 'lucide-react';

export default function AuthichainEnterprise() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gold/10 blur-[150px] rounded-full opacity-50" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            <Shield className="w-4 h-4" />
            Enterprise Authentication Protocol
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter uppercase leading-[0.85]">
            The Standard <br />
            For <span className="gold-text">Verifiable</span> Truth
          </h1>
          
          <p className="max-w-2xl mx-auto text-zinc-500 text-lg md:text-xl font-medium mb-12 leading-relaxed">
            AuthiChain is the underlying trust layer for the visual internet. 
            We provide government-grade cryptographic signing and blockchain anchoring 
            for physical and digital assets at industrial scale.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard" className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold">
              Launch Console
            </Link>
            <Link href="/docs" className="btn-outline-gold px-12 py-5 font-black uppercase tracking-widest text-xs border-zinc-800">
              API Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Protocol Stats */}
      <section className="max-w-6xl mx-auto px-6 py-12 border-y border-zinc-900 bg-zinc-950/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          {[
            { label: 'Total Verifications', val: '124M+' },
            { label: 'Network Nodes', val: '8,420' },
            { label: 'Settlement Time', val: '< 2.5s' },
            { label: 'Uptime SLA', val: '99.99%' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black gold-text mb-1">{s.val}</p>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="protocol-card p-10 group hover:border-gold/40 transition-all">
            <Lock className="w-10 h-10 text-gold mb-8 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-black uppercase tracking-tight mb-4 text-white">Ed25519 Signing</h3>
            <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">
              Every asset is signed with Ed25519 elliptic curve cryptography, ensuring non-repudiation and global verifiability without a central authority.
            </p>
          </div>
          <div className="protocol-card p-10 group hover:border-gold/40 transition-all">
            <Database className="w-10 h-10 text-gold mb-8 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-black uppercase tracking-tight mb-4 text-white">Immutable Anchor</h3>
            <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">
              Provenance data is hashed and anchored on the Polygon network, providing a permanent, tamper-proof record of every scan and transaction.
            </p>
          </div>
          <div className="protocol-card p-10 group hover:border-gold/40 transition-all">
            <Server className="w-10 h-10 text-gold mb-8 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-black uppercase tracking-tight mb-4 text-white">High-Throughput API</h3>
            <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">
              Our edge-optimized API handles 50,000+ requests per second, designed for massive retail events and global supply chain integrations.
            </p>
          </div>
        </div>
      </section>

      {/* Developers Section */}
      <section className="bg-zinc-950 border-t border-zinc-900 py-24 px-6 overflow-hidden relative">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="text-4xl font-black mb-8 uppercase tracking-tighter leading-none">
              Built For <span className="gold-text">Engineers.</span> <br />
              Scaled For Giants.
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Zap className="w-5 h-5 text-gold mt-1" />
                <div>
                  <h4 className="font-bold text-white uppercase text-sm">Low-Latency SDKs</h4>
                  <p className="text-zinc-500 text-xs mt-1 uppercase tracking-tighter">Native support for Node.js, Go, Rust, and Python.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Code className="w-5 h-5 text-gold mt-1" />
                <div>
                  <h4 className="font-bold text-white uppercase text-sm">Webhooks & Automation</h4>
                  <p className="text-zinc-500 text-xs mt-1 uppercase tracking-tighter">Trigger custom logic on scan, verification, or revocation events.</p>
                </div>
              </div>
            </div>
            <Link href="/docs" className="btn-gold inline-flex items-center gap-3 px-10 py-4 font-black uppercase tracking-widest text-[10px] mt-12 shadow-gold">
              Read the Protocol Spec <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex-1 w-full max-w-lg">
            <div className="protocol-card p-1 bg-zinc-900/50 border-zinc-800">
              <div className="bg-black rounded-lg p-6 font-mono text-[11px] leading-relaxed">
                <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-zinc-600 ml-2">authichain-verify.ts</span>
                </div>
                <div className="text-zinc-400">
                  <span className="text-gold">import</span> &#123; AuthiChain &#125; <span className="text-gold">from</span> <span className="text-zinc-300">&apos;@authichain/sdk&apos;</span>;
                  <br /><br />
                  <span className="text-gold">const</span> client = <span className="text-gold">new</span> <span className="text-zinc-200">AuthiChain</span>(&#123; 
                  <br />&nbsp;&nbsp;apiKey: process.env.AUTHICHAIN_KEY 
                  <br />&#125;);
                  <br /><br />
                  <span className="text-gold">const</span> result = <span className="text-gold">await</span> client.<span className="text-zinc-200">verify</span>(payload);
                  <br /><br />
                  <span className="text-gold">if</span> (result.is_authentic) &#123;
                  <br />&nbsp;&nbsp;console.<span className="text-zinc-200">log</span>(<span className="text-zinc-300">&apos;✅ Cryptographically Valid&apos;</span>);
                  <br />&nbsp;&nbsp;console.<span className="text-zinc-200">log</span>(<span className="text-zinc-300">{'`Anchor: ${result.tx_hash}`'}</span>);
                  <br />&#125;
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-zinc-900 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
            <div>
              <div className="flex items-center gap-2 text-white font-black text-xl tracking-tighter uppercase mb-4">
                <Shield className="w-6 h-6 text-gold" />
                AuthiChain
              </div>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed">
                The global standard for cryptographically-verified product identity and industrial provenance.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-16">
              <div>
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Network</h4>
                <ul className="space-y-4 text-xs font-bold uppercase tracking-tighter text-zinc-400">
                  <li><Link href="/governance" className="hover:text-gold transition-colors">GovChain.us</Link></li>
                  <li><Link href="/status" className="hover:text-gold transition-colors">Network Status</Link></li>
                  <li><Link href="/explorers" className="hover:text-gold transition-colors">Chain Explorer</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Solutions</h4>
                <ul className="space-y-4 text-xs font-bold uppercase tracking-tighter text-zinc-400">
                  <li><Link href="/digital-product-passport" className="hover:text-gold transition-colors">StrainChain.io</Link></li>
                  <li><Link href="/enterprise" className="hover:text-gold transition-colors">Supply Chain</Link></li>
                  <li><Link href="/legal" className="hover:text-gold transition-colors">Compliance</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Contact</h4>
                <p className="text-xs font-bold uppercase tracking-tighter text-zinc-400">Z@authichain.com</p>
                <div className="mt-4 flex gap-4">
                    <Globe className="w-4 h-4 text-zinc-800" />
                    <Server className="w-4 h-4 text-zinc-800" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 pt-8 border-t border-zinc-900/50">
            <p className="text-[10px] font-bold text-zinc-800 uppercase tracking-[0.4em]">
              &copy; 2026 AuthiChain Protocol ◆ All Rights Reserved
            </p>
            <div className="flex gap-8">
                <Link href="/terms" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold">Terms</Link>
                <Link href="/privacy" className="text-[10px] font-black uppercase text-zinc-600 hover:text-gold">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
