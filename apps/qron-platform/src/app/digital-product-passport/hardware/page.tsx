import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ChevronLeft,
  Smartphone,
  Cpu
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Hardware Integration | StrainChain Protocol',
  description: 'Learn about the Elite Mobile App node and hardware integrations like NFC and RFID.',
};

export default function StrainChainHardware() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Smartphone className="w-3 h-3" />
              Hardware Nodes
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          EDGE <br /> <span className="gold-text">COMPUTING.</span>
        </h1>

        <div className="grid md:grid-cols-2 gap-12 mt-20">
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Smartphone className="w-8 h-8 text-gold mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Elite Mobile Node</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                The QRON Elite App transforms any modern smartphone into a high-speed industrial scanning node. It leverages native GPU acceleration to perform Ed25519 signature verification locally, enabling secure, offline-first compliance checks in remote agricultural or manufacturing environments.
              </p>
              <Link href="/elite" className="mt-8 inline-flex btn-gold px-6 py-3 text-[10px] font-black uppercase tracking-widest">
                  View Elite App
              </Link>
            </div>
            
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Cpu className="w-8 h-8 text-blue-400 mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">RFID & NFC Bridge</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                StrainChain seamlessly bridges digital QRON artifacts with physical hardware. We support syncing with Metrc RFID tags for cannabis compliance, and encrypted NTAG424 DNA chips for luxury goods. The digital twin stays synchronized with the physical asset's telemetry in real-time.
              </p>
            </div>
        </div>
      </div>
    </div>
  );
}