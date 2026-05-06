import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import Image from 'next/image';
import { Shield, Sparkles, ChevronLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'QRON Gallery â€” Authentic AI QR Masterpieces',
  description:
    'Browse the official collection of cryptographically signed AI QR art. 100% scannable, verifiable, and beautiful.',
};

const STYLE_LABELS: Record<string, string> = {
  space: 'Cosmic Space',
  cannabis: 'Cannabis',
  cyberpunk: 'Cybernetic',
  nature: 'Botanical',
  abstract: 'Abstract',
  retro: 'Retro Vintage',
  holographic: 'Holographic',
};

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: demos } = await supabase
    .from('qrons')
    .select('*')
    .eq('is_demo', true)
    .order('createdAt', { ascending: false });

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full opacity-50" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-gold/5 blur-[100px] rounded-full opacity-30" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-zinc-500 hover:text-gold transition-colors text-xs font-bold uppercase tracking-widest mb-10"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Generator
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold uppercase tracking-widest mb-4">
              <Shield className="w-3 h-3" />
              AuthiChain Verified Collection
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
              AI QR <span className="gold-text">GALLERY</span>
            </h1>
            <p className="text-zinc-500 text-lg leading-relaxed">
              Every masterpiece below is a functional, 100% scannable QR code
              signed by the AuthiChain Protocol. Scan any with your phone to
              verify.
            </p>
          </div>
        </div>

        {demos && demos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {demos.map((demo) => (
              <div
                key={demo.id}
                className="protocol-card group overflow-hidden border-zinc-900 hover:border-gold/30 transition-all duration-500"
              >
                <div className="relative aspect-square overflow-hidden bg-zinc-950">
                  <Image
                    src={demo.image_url}
                    alt={demo.prompt || 'QRON Artwork'}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-sm font-medium line-clamp-2 mb-3 leading-snug">
                      {demo.prompt}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-gold font-black px-2 py-1 rounded bg-gold/10 border border-gold/20">
                        {demo.mode}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">
                        {demo.scan_count || 0} VERIFIED SCANS
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between bg-zinc-900/20">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    {STYLE_LABELS[demo.mode] || demo.mode} Edition
                  </span>
                  <Shield className="w-3 h-3 text-gold opacity-50" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
            <Sparkles className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">
              The gallery is being curated. Check back soon.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="protocol-card p-12 text-center bg-gold-gradient bg-opacity-5">
          <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">
            Create Your Own Masterpiece
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">
            Ready to secure your visual identity? Generate your first QRON for
            free or order a custom brand pack.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/" className="btn-gold px-10 py-3 font-black">
              Generate Free â†’
            </Link>
            <Link
              href="/affiliate"
              className="btn-outline-gold px-10 py-3 font-bold border-zinc-800 text-zinc-300"
            >
              Earn with QRON
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
