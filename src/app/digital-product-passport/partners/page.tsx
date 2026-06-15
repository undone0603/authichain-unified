import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ChevronLeft,
  Handshake,
  Network
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Ecosystem Partners | StrainChain Protocol',
  description: 'Discover the integration partners, label printers, and certification bodies powering StrainChain.',
};

export default function StrainChainPartners() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Handshake className="w-3 h-3" />
              Ecosystem Partners
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          THE TRUST <br /> <span className="gold-text">NETWORK.</span>
        </h1>

        <p className="max-w-2xl text-zinc-400 text-lg font-medium mb-16 leading-relaxed">
            StrainChain is not built in isolation. We partner with the world's leading commercial printers, certification bodies, and trade associations to ensure our cryptographic standards integrate seamlessly into existing global supply chains.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Network className="w-8 h-8 text-gold mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">White-Label Printers</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter mb-6">
                We empower commercial printers like FASTSIGNS and MOO to embed our verification protocol directly into their workflows. 
              </p>
              <Link href="/white-label" className="text-[10px] font-black text-gold uppercase hover:underline">
                  View Reseller Program &rarr;
              </Link>
            </div>
            
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <ShieldCheck className="w-8 h-8 text-blue-400 mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Certification Bodies</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                We are actively collaborating with global certification leaders like SGS and Bureau Veritas to ensure our Digital Product Passports meet the most stringent international compliance standards.
              </p>
            </div>
        </div>
      </div>
    </div>
  );
}