'use client';

import { Search, Database, ExternalLink, Globe } from 'lucide-react';
import Link from 'next/link';

export default function ExplorersPage() {
  const explorers = [
    { name: 'GovChain Registry', type: 'Public', url: 'https://govchain.us', desc: 'Government-verified entity registry and certification logs.' },
    { name: 'Polygonscan (PoS)', type: 'On-Chain', url: 'https://polygonscan.com', desc: 'Blockchain explorer for anchored protocol transactions.' },
    { name: 'AuthiChain Core', type: 'Protocol', url: 'https://authichain.com/nodes', desc: 'Real-time node telemetry and distributed consensus logs.' },
    { name: 'StrainChain Explorer', type: 'Industrial', url: 'https://strainchain.io', desc: 'Specific explorer for high-compliance industrial assets.' },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <header className="mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest mb-6">
            <Database className="w-3.5 h-3.5" />
            Distributed Protocol Transparency
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tight leading-none mb-6">
            Chain <span className="gold-text">Explorers</span>
          </h1>
          <p className="text-zinc-500 text-lg font-medium max-w-2xl leading-relaxed uppercase tracking-tighter">
            Access the underlying ledgers and registries that power the AuthiChain ecosystem. 
            All data is cryptographically verifiable and anchored for permanence.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {explorers.map((e) => (
            <div key={e.name} className="protocol-card p-10 group hover:border-gold/30 transition-all flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-gold transition-colors">
                    <Globe className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700 bg-zinc-900/50 px-3 py-1 rounded">
                    {e.type}
                  </span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-4 group-hover:gold-text transition-colors">
                  {e.name}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed mb-10 uppercase tracking-tighter">
                  {e.desc}
                </p>
              </div>
              <a 
                href={e.url} 
                target="_blank" 
                rel="noreferrer"
                className="btn-outline-gold py-4 px-6 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest border-zinc-900 group-hover:border-gold/40"
              >
                Launch Explorer <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>

        <section className="protocol-card p-12 bg-zinc-950/50 border-dashed border-zinc-900 text-center">
            <Search className="w-10 h-10 text-zinc-800 mx-auto mb-6" />
            <h4 className="text-xl font-black uppercase tracking-tight text-zinc-400 mb-4">Direct Transaction Lookup</h4>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mb-8 max-w-md mx-auto">
                Enter an AuthiChain Anchor Hash or TxID to verify a specific issuance directly from the protocol core.
            </p>
            <div className="flex max-w-xl mx-auto gap-4">
                <input 
                    type="text" 
                    placeholder="0x... or auth_..." 
                    className="flex-1 bg-black border border-zinc-900 rounded-xl px-6 py-4 text-xs font-mono outline-none focus:border-gold transition-colors"
                />
                <button className="btn-gold px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Verify
                </button>
            </div>
        </section>

        <footer className="mt-32 pt-12 border-t border-zinc-900 text-center">
            <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em] mb-4">
                Distributed Consensus Â· 2026 AuthiChain Inc.
            </p>
            <div className="flex justify-center gap-8 text-zinc-600 text-[9px] font-black uppercase tracking-widest">
                <Link href="/governance" className="hover:text-gold transition-colors">Governance</Link>
                <Link href="/docs" className="hover:text-gold transition-colors">SDKs</Link>
                <Link href="/legal" className="hover:text-gold transition-colors">Legal</Link>
            </div>
        </footer>
      </div>
    </div>
  );
}
