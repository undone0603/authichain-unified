import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Shield, 
  ChevronLeft,
  MapPin,
  Clock,
  Target
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About | AuthiChain Protocol',
  description: 'The origin story of the AuthiChain Protocol, built from the ground up to secure the visual internet.',
};

export default function AuthichainAbout() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Shield className="w-3 h-3" />
              AuthiChain Protocol
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          BORN IN THE <br /> <span className="gold-text">HEARTLAND.</span>
        </h1>

        <div className="space-y-8 text-lg text-zinc-400 leading-relaxed font-medium">
          <p>
            AuthiChain wasn't born in Silicon Valley. It was architected by a solo founder in Gaylord, Michigan, with a singular mission: to build the infrastructure that makes truth verifiable.
          </p>
          <p>
            In an era of deepfakes, AI-generated fraud, and global counterfeiting, the visual internet lost its anchor to reality. We set out to fix that by creating a protocol where every physical and digital artifact can cryptographically prove its own origin.
          </p>
          <p>
            Today, AuthiChain secures millions of assets across the globe, from industrial supply chains to high-value consumer goods. We believe that truth is not a feature—it is the foundational protocol for the next decade of commerce.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {[
            { icon: MapPin, label: 'HQ', val: 'Gaylord, MI' },
            { icon: Clock, label: 'Founded', val: '2025' },
            { icon: Target, label: 'Mission', val: 'Verifiable Truth' }
          ].map(s => (
             <div key={s.label} className="p-6 bg-zinc-950 border border-zinc-900 rounded-xl">
               <s.icon className="w-5 h-5 text-gold mb-4" />
               <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-1">{s.label}</p>
               <p className="text-sm font-bold text-white uppercase">{s.val}</p>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}