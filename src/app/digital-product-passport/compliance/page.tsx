import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ChevronLeft,
  FileText,
  AlertTriangle
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'EU DPP Compliance | StrainChain Protocol',
  description: 'Details on EU 2024/1789 Digital Product Passport requirements and regulatory timelines.',
};

export default function StrainChainCompliance() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" />
              Regulatory Compliance
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          EU 2024/1789 <br /> <span className="gold-text">MANDATE.</span>
        </h1>

        <div className="protocol-card p-10 bg-red-500/5 border-red-500/20 mb-16">
            <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <h3 className="text-xl font-black uppercase tracking-tight text-red-400">Compliance Deadline Approaching</h3>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">
                By July 2026, the European Union requires a standardized Digital Product Passport (DPP) for high-impact physical goods. StrainChain provides the only cryptographically verifiable data carrier that meets both EU regulatory standards and global brand aesthetic requirements.
            </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
                <FileText className="w-8 h-8 text-gold mb-6" />
                <h3 className="text-xl font-black uppercase tracking-tight mb-4">Immutable Data Carrier</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                    QRON technology serves as the primary data carrier, linking physical products to their decentralized digital twin. Every scan accesses a cryptographically signed payload containing carbon footprint, repairability, and material composition data.
                </p>
            </div>
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
                <ShieldCheck className="w-8 h-8 text-blue-400 mb-6" />
                <h3 className="text-xl font-black uppercase tracking-tight mb-4">Decentralized Registry</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                    Instead of a centralized vulnerability point, StrainChain anchors all passport states to the Polygon network. Regulators and consumers can independently verify the chain of custody without relying on third-party audits.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}