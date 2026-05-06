import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import Image from 'next/image';
import { 
  Shield, 
  Sparkles, 
  ChevronLeft, 
  Leaf, 
  ExternalLink,
  Coins,
  LayoutGrid,
  Filter
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'StrainChain NFT Marketplace â€” High-Value Industrial SVGs',
  description:
    'The premier marketplace for cryptographically-verified industrial artifacts and AI QR masterpieces on Base.',
};

/**
 * NFT Marketplace for StrainChain.io
 * Monetization Solution: High-Value SVG assets + Secondary Royalties
 */
export default async function MarketplacePage() {
  const supabase = await createClient();
  
  // 1. Fetch High-Value SVG Artifacts (Industrial & Premium)
  // These are assets stored in Supabase with .svg extensions or marked as premium
  const { data: artifacts } = await supabase
    .from('qrons')
    .select('*')
    .or('mode.eq.industrial,mode.eq.living')
    .order('createdAt', { ascending: false });

  // 2. Fetch Featured Community Collection
  const { data: gallery } = await supabase
    .from('qrons')
    .select('*')
    .eq('is_demo', true)
    .order('scan_count', { ascending: false })
    .limit(24);

  // 3. Fetch Artistic Samples specifically
  const { data: artisticSamples } = await supabase
    .from('qrons')
    .select('*')
    .eq('is_demo', true)
    .like('image_url', '%/samples/%')
    .limit(12);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden selection:bg-gold selection:text-black">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-40">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-green-500/5 blur-[140px] rounded-full" />
        <div className="absolute bottom-[0%] right-[-10%] w-[50%] h-[50%] bg-gold/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Navigation */}
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <div className="flex items-center gap-8">
                <Link href="/" className="group flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Generator</span>
                </Link>
                <div className="h-4 w-px bg-zinc-800" />
                <div className="flex items-center gap-2 text-gold">
                    <Coins className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-tighter italic">StrainChain Marketplace</span>
                </div>
            </div>
            <nav className="hidden md:flex items-center gap-8">
                <Link href="/explorers" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-gold transition-colors">Network Status</Link>
                <Link href="/governance" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-gold transition-colors">DAO Registry</Link>
                <div className="p-2 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3 h-3 text-gold" />
                    Base Mainnet
                </div>
            </nav>
        </header>

        {/* Hero Section */}
        <div className="mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <Leaf className="w-4 h-4" />
            Verified Industrial Provenance
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-none">
            OWN THE <br /> <span className="gold-text">ARTIFACT.</span>
          </h1>
          <p className="max-w-2xl text-zinc-500 text-lg md:text-xl font-medium uppercase tracking-widest leading-relaxed">
            Trade high-resolution .SVG artifacts anchored by AuthiChain. 
            Industrial telemetry meets creative digital scarcity.
          </p>
        </div>

        {/* Marketplace Grid: SVG Artifacts */}
        <section className="mb-32">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-gold" />
              <h2 className="text-xl font-black uppercase tracking-tight italic">Industrial SVG Assets</h2>
            </div>
            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white">
                <Filter className="w-3 h-3" /> Filter: All Artifacts
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {artifacts?.map((item) => (
              <div
                key={item.id}
                className="protocol-card group relative bg-zinc-950/50 border-zinc-900 hover:border-gold/40 transition-all duration-500 hover:-translate-y-2"
              >
                {/* Secondary Royalty Badge */}
                <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-gold/20 text-[9px] font-black text-gold uppercase tracking-widest">
                    5% Royalty
                </div>

                <div className="relative aspect-square overflow-hidden bg-zinc-900 p-8">
                  <Image
                    src={item.image_url}
                    alt={item.prompt || 'Industrial Artifact'}
                    fill
                    className="object-contain p-12 transition-transform duration-700 group-hover:scale-110 drop-shadow-[0_0_30px_rgba(201,162,39,0.2)]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent flex flex-col justify-end p-8">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="p-1 rounded bg-gold/10 text-gold border border-gold/20">
                            <Shield className="w-3 h-3" />
                        </span>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Signed Ed25519</span>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2 line-clamp-1">
                      {item.prompt || `Artifact #${item.id}`}
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        <span className="flex items-center gap-1 text-gold"><Leaf className="w-3 h-3" /> {item.mode}</span>
                        <span>â€¢</span>
                        <span>0.045 ETH</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button className="btn-gold py-3 text-[10px] font-black uppercase tracking-widest shadow-gold">
                          Collect Now
                      </button>
                      <Link 
                        href={`/p/${item.shortCode || item.id}`}
                        className="btn-outline-gold py-3 text-[10px] font-black uppercase tracking-widest border-zinc-800 text-center flex items-center justify-center gap-2"
                      >
                          Verify <ExternalLink className="w-3 h-3 opacity-50" />
                      </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Global Showcase: Community Favorites */}
        <section className="mb-24 pt-24 border-t border-zinc-900">
           <div className="flex items-center gap-3 mb-12">
              <Sparkles className="w-5 h-5 text-gold" />
              <h2 className="text-xl font-black uppercase tracking-tight italic text-zinc-400">Creative Registry</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                {gallery?.map((g) => (
                    <div key={g.id} className="protocol-card aspect-square overflow-hidden group cursor-pointer border-zinc-900/50">
                        <Image 
                            src={g.image_url} 
                            alt="community qron" 
                            width={200} 
                            height={200} 
                            className="object-cover transition-transform duration-500 group-hover:scale-125 group-hover:rotate-6 opacity-60 group-hover:opacity-100 grayscale group-hover:grayscale-0"
                        />
                    </div>
                ))}
            </div>
        </section>

        {/* Artistic AI Masterpieces Section */}
        {artisticSamples && artisticSamples.length > 0 && (
          <section className="mb-32 pt-24 border-t border-zinc-900">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-gold" />
                <h2 className="text-xl font-black uppercase tracking-tight italic">Artistic AI Masterpieces</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {artisticSamples.map((sample) => (
                <div key={sample.id} className="protocol-card group bg-zinc-950/30 border-zinc-900 hover:border-gold/30 transition-all">
                  <div className="relative aspect-square overflow-hidden">
                    <Image 
                      src={sample.image_url} 
                      alt={sample.prompt} 
                      fill 
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                      <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-relaxed">
                        {sample.prompt}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 border-t border-zinc-900 flex justify-between items-center">
                    <span className="text-[9px] font-black text-gold uppercase tracking-[0.2em]">{sample.mode}</span>
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{sample.scan_count} Scans</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Elite Tier Monetization CTA */}
        <div className="protocol-card p-12 md:p-20 text-center bg-zinc-950 border-gold/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tighter">
            THE <span className="gold-text italic">ELITE</span> APP
          </h2>
          <p className="text-zinc-500 mb-10 max-w-lg mx-auto leading-relaxed font-medium uppercase tracking-[0.2em] text-xs">
            Unlock mobile-native generation, exclusive SVG drops, and automated industrial reports. 
            Available on iOS and Android.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="btn-gold px-12 py-4 font-black uppercase tracking-widest text-xs shadow-gold">
              Get Mobile Access â†’
            </button>
          </div>
        </div>
      </div>

      {/* Industrial Footer */}
      <footer className="py-12 px-6 border-t border-zinc-900 mt-32">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 opacity-40">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
            StrainChain Protocol ◆ Industrial Marketplace Ecosystem
          </p>
          <div className="flex gap-8 text-[9px] font-black uppercase tracking-widest text-zinc-500">
             <span>Terms of Scarcity</span>
             <span>Royalty Policy</span>
             <span>Network: Base Mainnet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
