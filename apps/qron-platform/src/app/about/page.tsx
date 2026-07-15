import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sparkles,
  ChevronLeft,
  Palette,
  Globe
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About | QRON Space',
  description: 'The consumer-facing story of visual cryptography and AI-generated QR art.',
};

export default function QronAbout() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Creative Studio
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          VISUAL <br /> <span className="gold-text">CRYPTOGRAPHY.</span>
        </h1>

        <div className="relative rounded-2xl overflow-hidden border border-zinc-900 mb-12 shadow-2xl">
          <Image
            src="/media/qron-grid-16.jpg"
            alt="QRON gallery — sixteen cryptographically-signed AI artworks: octopus, lion, locomotive, violin, pyramid, butterfly, volcano, rose, mushroom, lens, hourglass, parchment, coral and more"
            width={1024}
            height={1024}
            className="w-full h-auto"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-6 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gold">
              Sixteen QRONs · One Protocol
            </p>
          </div>
        </div>

        <div className="space-y-8 text-lg text-zinc-400 leading-relaxed font-medium">
          <p>
            QRON is where industrial-grade security meets generative AI art. We believe that product authentication shouldn&apos;t be a generic, hidden barcode—it should be a beautiful, engaging brand asset.
          </p>
          <p>
            Powered by the AuthiChain Protocol, every QRON is a &ldquo;Living QR.&rdquo; It combines a highly scannable, error-corrected QR matrix with a ControlNet-augmented Stable Diffusion pipeline. The result is a unique piece of digital art that also functions as an immutable, Ed25519-signed data carrier.
          </p>
          <p>
            Whether you are a luxury fashion house looking to secure your latest collection or an independent creator dropping a new NFT, QRON turns your provenance into a masterpiece.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-16">
          {[
            { icon: Palette, label: 'Artistry', val: 'Hugging Face SDXL' },
            { icon: Globe, label: 'Provenance', val: 'Polygon Anchored' }
          ].map(s => (
             <div key={s.label} className="p-6 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center gap-6">
               <div className="p-4 rounded-xl bg-gold/10">
                   <s.icon className="w-6 h-6 text-gold" />
               </div>
               <div>
                   <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-1">{s.label}</p>
                   <p className="text-sm font-bold text-white uppercase">{s.val}</p>
               </div>
             </div>
          ))}
        </div>

        <div className="mt-20">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4">
            The Studio · In Motion
          </p>
          <div className="relative rounded-2xl overflow-hidden border border-zinc-900 shadow-2xl bg-zinc-950">
            <video
              src="/media/qron-avatar-720p.mp4"
              className="w-full h-auto"
              controls
              playsInline
              preload="metadata"
            />
          </div>
        </div>
      </div>
    </div>
  );
}