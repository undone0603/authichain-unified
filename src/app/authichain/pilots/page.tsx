import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Shield,
  ChevronLeft,
  Building2,
  FileCheck,
  Stamp,
  ArrowRight
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pilots & Case Studies | AuthiChain Protocol',
  description: 'Explore active enterprise and government pilots utilizing the AuthiChain Protocol.',
};

export default function AuthichainPilots() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Shield className="w-3 h-3" />
              Active Deployments
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          ENTERPRISE <br /> <span className="gold-text">PILOTS.</span>
        </h1>

        <div className="space-y-12 mt-20">
            {/* Pilot 1 */}
            <div className="protocol-card p-10 border-zinc-800 bg-zinc-950/50 flex flex-col md:flex-row gap-10 items-center">
                <div className="w-20 h-20 shrink-0 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-gold" />
                </div>
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-2xl font-black uppercase tracking-tight">BMW Group (Supply Chain)</h3>
                        <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 text-[10px] font-black uppercase tracking-widest">Active</span>
                    </div>
                    <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                        Eliminating 14-day physical battery quarantine delays using Edge Cryptography. High-voltage battery packs are verified at the source using Ed25519 signatures, enabling frictionless cross-border transfer.
                    </p>
                </div>
            </div>

            {/* Pilot 2 */}
            <div className="protocol-card p-10 border-zinc-800 bg-zinc-950/50 flex flex-col md:flex-row gap-10 items-center">
                <div className="w-20 h-20 shrink-0 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <FileCheck className="w-10 h-10 text-gold" />
                </div>
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-2xl font-black uppercase tracking-tight">FTC Compliance Shield</h3>
                        <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase tracking-widest">Deploying</span>
                    </div>
                    <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                        Responding directly to EO 14392, multiple domestic manufacturers are deploying the AuthiChain SDK to cryptographically anchor &ldquo;Made in USA&rdquo; claims to the Polygon network, ensuring irrefutable audit trails.
                    </p>
                </div>
            </div>

            {/* Pilot 3 — Roscommon */}
            <Link
              href="/authichain/pilots/roscommon"
              className="protocol-card p-10 border-gold/30 flex flex-col md:flex-row gap-10 items-center group hover:border-gold/60 transition-all"
              style={{ background: 'linear-gradient(135deg, rgba(201,162,39,0.08) 0%, rgba(13,13,13,0.6) 60%)' }}
            >
                <div className="w-20 h-20 shrink-0 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                    <Stamp className="w-10 h-10 text-gold" />
                </div>
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4 mb-2">
                        <h3 className="text-2xl font-black uppercase tracking-tight">USPS · Roscommon Phygital Stamp</h3>
                        <span className="px-2 py-1 rounded bg-gold/15 border border-gold/30 text-gold text-[10px] font-black uppercase tracking-widest">Proposed · Pilot Open</span>
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed font-medium mb-3">
                        Heart of Michigan testbed: a QRON-stamped postcard that opens a 3D landmark tour, an AI-narrated town history, and a local-business coupon book — turning every piece of mail into a micro-tourism billboard with a sponsorship revenue stream for the Postal Service.
                    </p>
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gold group-hover:translate-x-1 transition-transform">
                        View pilot prospectus <ArrowRight className="w-3 h-3" />
                    </span>
                </div>
            </Link>
        </div>

        <div className="mt-20 text-center">
            <h3 className="text-2xl font-black uppercase tracking-tight mb-6">Ready to secure your supply chain?</h3>
            <Link href="/dashboard" className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold inline-block">
              Request Pilot Access
            </Link>
        </div>
      </div>
    </div>
  );
}