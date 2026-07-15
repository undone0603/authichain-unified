'use client';

import { Shield, FileText, Gavel, Scale } from 'lucide-react';
import Link from 'next/link';

export default function LegalPage() {
  const documents = [
    { name: 'Terms of Protocol', path: '/terms', desc: 'The fundamental legal agreement for using the QRON ecosystem.' },
    { name: 'Privacy & Data', path: '/privacy', desc: 'How we handle PII and cryptographic metadata across the network.' },
    { name: 'Industrial Compliance', path: '/legal/industrial', desc: 'Specific legal frameworks for high-compliance industrial assets.' },
    { name: 'Cookie Policy', path: '/legal/cookies', desc: 'Transparency on tracking and edge session management.' },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <header className="mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6">
            <Gavel className="w-3.5 h-3.5" />
            Legal Framework v2.4
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tight leading-none mb-6">
            Legal <span className="gold-text">Console</span>
          </h1>
          <p className="text-zinc-500 text-lg font-medium max-w-2xl leading-relaxed uppercase tracking-tighter">
            Access the legal agreements, compliance certificates, and governance 
            documents that define the AuthiChain Protocol standards.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
          {documents.map((d) => (
            <Link key={d.name} href={d.path} className="protocol-card p-8 group hover:border-gold/30 transition-all block">
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-gold transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-[9px] font-black uppercase text-zinc-700 group-hover:text-gold transition-colors">
                  View Document &rarr;
                </div>
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2">
                {d.name}
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed uppercase tracking-tighter">
                {d.desc}
              </p>
            </Link>
          ))}
        </div>

        <section className="space-y-12">
            <div className="flex items-center gap-4 border-b border-zinc-900 pb-8">
                <Scale className="w-8 h-8 text-gold" />
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Regulatory Compliance</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Global Standard Alignment</p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {[
                    { title: 'GDPR / CCPA', desc: 'Full compliance with international data privacy and "right to be forgotten" standards.' },
                    { title: 'EU DPP v2', desc: 'Aligned with the upcoming European Digital Product Passport mandates for industrial goods.' },
                    { title: 'ISO 27001', desc: 'Protocol-level security management and cryptographic key rotation standards.' }
                ].map(item => (
                    <div key={item.title}>
                        <h4 className="font-black text-xs uppercase text-zinc-200 mb-2">{item.title}</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-tighter">{item.desc}</p>
                    </div>
                ))}
            </div>
        </section>

        <footer className="mt-32 pt-12 border-t border-zinc-900 flex justify-between items-center">
             <div className="flex items-center gap-2 text-zinc-800 font-black text-xs tracking-tighter uppercase">
                <Shield className="w-4 h-4 text-zinc-800" />
                AuthiChain Legal
              </div>
              <Link href="/" className="text-[10px] font-black uppercase text-zinc-600 hover:text-white">
                Back to Home
              </Link>
        </footer>
      </div>
    </div>
  );
}
