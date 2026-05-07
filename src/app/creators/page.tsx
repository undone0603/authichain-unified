import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sparkles,
  ChevronLeft,
  Paintbrush,
  Code
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Creators | QRON Space',
  description: 'A dedicated hub for artists and developers building on the QRON platform.',
};

export default function QronCreators() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Paintbrush className="w-3 h-3" />
              Creator Hub
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          BUILD THE <br /> <span className="gold-text">VISUAL INTERNET.</span>
        </h1>

        <div className="grid md:grid-cols-[1fr_auto] gap-12 items-center mb-16">
          <p className="max-w-2xl text-zinc-400 text-lg font-medium leading-relaxed">
              We are actively looking for digital artists, 3D modelers, and developers to build custom ControlNet models and preset aesthetics for the QRON generator.
          </p>
          <div className="relative w-full md:w-[260px] aspect-square rounded-2xl overflow-hidden border border-zinc-900 shadow-2xl bg-zinc-950">
            <Image
              src="/media/qron-grid-4.png"
              alt="Four QRON preset previews — sample of what creators can ship"
              fill
              sizes="(min-width: 768px) 260px, 100vw"
              className="object-cover"
            />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur border border-gold/30 text-gold text-[9px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Preset Previews
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Paintbrush className="w-8 h-8 text-gold mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Artist Grants</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter mb-6">
                The GovChain DAO has allocated a treasury grant specifically for creators. If you can train a highly reliable, aesthetically unique ControlNet model for our QR pipeline, you can earn $QRON for every time your preset is used.
              </p>
              <Link href="/governance" className="text-[10px] font-black text-gold uppercase hover:underline">
                  View DAO Proposals &rarr;
              </Link>
            </div>
            
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Code className="w-8 h-8 text-blue-400 mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Developer SDK</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter mb-6">
                Embed the QRON generation engine directly into your own applications. We provide a drop-in React component and a REST API for high-volume programmatic minting.
              </p>
              <Link href="/docs" className="text-[10px] font-black text-blue-400 uppercase hover:underline">
                  Read the Docs &rarr;
              </Link>
            </div>
        </div>

        <div className="mt-20 text-center">
            <h3 className="text-2xl font-black uppercase tracking-tight mb-6">Join the Creator Network</h3>
            <a href="mailto:creators@qron.space" className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold inline-block">
              Apply for Grant
            </a>
        </div>
      </div>
    </div>
  );
}