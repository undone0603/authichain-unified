'use client';

import { Shield, Printer, Users, Zap, CheckCircle2, FileText, ArrowRight, Gavel, Globe } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function PartnerBriefPage() {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-gold selection:text-white font-sans">
      {/* Executive Header */}
      <header className="bg-black text-white py-12 px-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-gold" />
                <span className="text-2xl font-black tracking-tighter uppercase">AuthiChain <span className="text-zinc-500">Federal</span></span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                Partner Intelligence Brief // 2026.Q2
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-10 py-20">
        {/* Title Block */}
        <div className="mb-20 border-l-8 border-gold pl-10">
            <h1 className="text-6xl font-black uppercase tracking-tighter leading-none mb-6">
                The New Standard for <br />
                <span className="text-gold italic">Made In USA</span> Labels
            </h1>
            <p className="text-xl text-zinc-600 font-medium max-w-3xl">
                A strategic partnership proposal for industrial label leaders to embed 
                cryptographic provenance directly into the domestic supply chain.
            </p>
        </div>

        {/* The Opportunity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-24">
            <section>
                <div className="flex items-center gap-3 mb-8">
                    <Gavel className="w-6 h-6 text-gold" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">The Regulatory Catalyst</h2>
                </div>
                <div className="space-y-6 text-zinc-700">
                    <p className="leading-relaxed">
                        With **EO 14392** and recent FTC enforcement sweeps (e.g., the $625k TouchTunes penalty), 
                        American manufacturers are facing unprecedented pressure to provide **verifiable proof** 
                        for &quot;Made in USA&quot; (MUSA) claims.
                    </p>
                    <p className="leading-relaxed font-bold">
                        The era of self-certification is over. Brands now require a consumer-facing 
                        cryptographic shield to mitigate legal risk.
                    </p>
                </div>
            </section>

            <section>
                <div className="flex items-center gap-3 mb-8">
                    <Zap className="w-6 h-6 text-gold" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">The AuthiChain Advantage</h2>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    {[
                        { title: 'Ed25519 Signing', desc: 'Immutable security' },
                        { title: 'Polygon Anchoring', desc: 'Public transparency' },
                        { title: 'Story Mode', desc: 'Consumer engagement' },
                        { title: 'Watchdog AI', desc: 'Real-time monitoring' }
                    ].map(feat => (
                        <div key={feat.title} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
                            <h4 className="font-black text-xs uppercase mb-1">{feat.title}</h4>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase">{feat.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>

        {/* Channel Strategy */}
        <section className="mb-24">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-12 text-center">Channel Integration Models</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-10 bg-black text-white rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Printer className="w-24 h-24" />
                    </div>
                    <h3 className="text-xl font-black uppercase mb-4 text-gold">Channel A: Label Printers</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                        Embed QRON technology into existing printing workflows. Offer &quot;AuthiChain-Verified&quot;
                        label stock as a high-margin premium service to MUSA clients.
                    </p>
                    <ul className="space-y-3 mb-10">
                        {['Direct API Integration', 'Substrate-level QRON', 'Revenue-share Model'].map(li => (
                            <li key={li} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-300">
                                <CheckCircle2 className="w-3 h-3 text-gold" /> {li}
                            </li>
                        ))}
                    </ul>
                    <div className="text-[9px] font-bold text-zinc-600 uppercase">Target: Avery Dennison, 3M, CCL, Brady</div>
                </div>

                <div className="p-10 bg-zinc-100 rounded-3xl relative overflow-hidden border border-zinc-200">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Users className="w-24 h-24 text-black" />
                    </div>
                    <h3 className="text-xl font-black uppercase mb-4 text-black">Channel B: Trade Associations</h3>
                    <p className="text-zinc-600 text-sm leading-relaxed mb-8">
                        Partner for industry-wide endorsement. Position AuthiChain as the &quot;Recommended
                        Provenance Standard&quot; for national manufacturing associations.
                    </p>
                    <ul className="space-y-3 mb-10">
                        {['Association Endorsements', 'Member Incentives', 'Compliance Webinars'].map(li => (
                            <li key={li} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-800">
                                <CheckCircle2 className="w-3 h-3 text-gold" /> {li}
                            </li>
                        ))}
                    </ul>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase">Target: NAM, AAM, NIST MEP, GS1 US</div>
                </div>
            </div>
        </section>

        {/* The Visual Reveal */}
        <section className="mb-24 p-12 bg-zinc-950 text-white rounded-3xl border border-zinc-900">
            <div className="flex flex-col md:flex-row gap-16 items-center">
                <div className="w-full md:w-1/2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[9px] font-black uppercase tracking-widest mb-6">
                        Live Demo Preview
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tight mb-6">The &quot;Story Mode&quot; <br />Digital Reveal</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter mb-8">
                        When a consumer scans the industrial seal, they don&apos;t just see a URL.
                        They witness the cinematic narrative of American craftsmanship.
                    </p>
                    <Link href="/gallery" className="btn-gold px-8 py-3 text-[10px] font-black uppercase tracking-widest">
                        View Sample Masterpieces &rarr;
                    </Link>
                </div>
                <div className="w-full md:w-1/2 flex justify-center">
                    <div className="relative w-64 h-64">
                         <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full scale-125" />
                         <Image src="/media/samples/03_flux_authichain.png" alt="Federal Seal" width={256} height={256} className="relative rounded-2xl shadow-2xl border border-gold/30" />
                    </div>
                </div>
            </div>
        </section>

        {/* Call to Action */}
        <footer className="text-center py-20 border-t border-zinc-100">
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-8">Initiate Partnership <span className="text-gold italic">Dialogue</span></h2>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mb-12">
                Limited Pilot Slots Available for 2026.Q3
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
                <a href="mailto:partners@authichain.com" className="bg-black text-white px-12 py-5 rounded-xl font-black uppercase tracking-widest text-[10px]">
                    Email Partnership Lead
                </a>
                <a href="https://qron.space/ftc-shield" className="bg-zinc-100 text-black px-12 py-5 rounded-xl font-black uppercase tracking-widest text-[10px] border border-zinc-200">
                    View Compliance Portal
                </a>
            </div>
        </footer>
      </main>

      {/* Corporate Strip */}
      <div className="bg-zinc-50 py-10 border-t border-zinc-200">
        <div className="max-w-5xl mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-12 opacity-30 grayscale contrast-125">
                 <Globe className="w-6 h-6" />
                 <FileText className="w-6 h-6" />
                 <Shield className="w-6 h-6" />
            </div>
            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.4em]">
                AuthiChain Protocol // Industrial Expansion Division // USA
            </p>
        </div>
      </div>
    </div>
  );
}
