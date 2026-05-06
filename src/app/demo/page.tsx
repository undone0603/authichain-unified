import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Shield, 
  Sparkles, 
  ChevronLeft, 
  Zap, 
  ExternalLink,
  QrCode,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Public Demo Gallery | AuthiChain AI QR Art',
  description: 'Experience the future of verifiable brand assets. Scan our public demos to see StoryMode narratives and blockchain anchoring in action.',
};

const DEMOS = [
  {
    id: 'demo-musa-shield',
    name: 'FTC "Made in USA" Shield',
    style: 'Patriotic Heritage',
    image: '/media/usa/unnamed.jpg',
    description: 'EO 14392 compliant origin proof for American manufacturing.',
    hash: '0x8f2a...1b9c'
  },
  {
    id: 'demo-bmw',
    name: 'BMW iX Pilot',
    style: 'Brushed Aluminum',
    image: '/media/samples/04_flux_ev_industry.png',
    description: 'Industrial telemetry meets luxury aesthetic. Anchored on Polygon.',
    hash: '0x2j8k...9f21'
  },
  {
    id: 'demo-rolex',
    name: 'Rolex Cosmograph',
    style: 'Holographic Gold',
    image: '/media/samples/06_flux_haute_couture.png',
    description: 'Cryptographic proof of authenticity for the world\'s finest timepieces.',
    hash: '0x7h3m...4a88'
  },
  {
    id: 'demo-nike',
    name: 'Nike kinetic',
    style: 'Liquid Motion',
    image: '/media/samples/10_flux_athletedao.png',
    description: 'Dynamic athlete storytelling through scannable sports art.',
    hash: '0x9p4l...2d11'
  },
  {
    id: 'demo-heritage',
    name: 'American Heritage',
    style: 'Vintage Industrial',
    image: '/media/usa/unnamed2.jpg',
    description: 'Verifiable craftsmanship and origin tracking for premium goods.',
    hash: '0x4c1e...8d33'
  }
];

export default function DemoGalleryPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between mb-20">
          <Link href="/" className="group flex items-center gap-2">
            <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Back to Generator</span>
          </Link>
          <div className="protocol-badge">
             <Shield className="w-3 h-3" />
             Public Demo Environment v2.4
          </div>
        </header>

        {/* Hero */}
        <div className="text-center mb-24">
          <h1 className="text-6xl font-black uppercase tracking-tighter mb-6 gold-text italic">The Masterpiece Gallery</h1>
          <p className="max-w-2xl mx-auto text-zinc-500 text-lg font-medium uppercase tracking-widest leading-relaxed">
            Experience how the world&apos;s leading brands use AuthiChain to turn packaging into verifiable digital assets.
          </p>
        </div>

        {/* Demo Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-32">
          {DEMOS.map((demo) => (
            <div key={demo.id} className="protocol-card group bg-zinc-950/50 border-zinc-900 hover:border-gold/30 transition-all duration-500 hover:-translate-y-2">
              <div className="aspect-square relative overflow-hidden bg-zinc-900 p-12">
                <Image 
                  src={demo.image} 
                  alt={demo.name} 
                  fill 
                  className="object-contain p-8 transition-transform duration-700 group-hover:scale-110 drop-shadow-[0_0_30px_rgba(201,162,39,0.15)]" 
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="px-6 py-3 rounded-full bg-gold text-black font-black uppercase text-[10px] tracking-widest shadow-gold">
                        Scan to Verify
                    </div>
                </div>
              </div>
              
              <div className="p-8">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white mb-1">{demo.name}</h3>
                        <p className="text-[10px] font-black text-gold uppercase tracking-widest">{demo.style} Edition</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed mb-8 uppercase font-medium tracking-tighter">
                  {demo.description}
                </p>
                <div className="pt-6 border-t border-zinc-900 flex justify-between items-center">
                   <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-zinc-700" />
                      <code className="text-[9px] font-mono text-zinc-700">{demo.hash}</code>
                   </div>
                   <Link href={`/reveal/${demo.id}`} className="text-[9px] font-black text-white hover:text-gold uppercase tracking-widest flex items-center gap-2">
                      View Anchor <ExternalLink className="w-3 h-3" />
                   </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Integration CTA */}
        <div className="protocol-card p-12 md:p-20 text-center bg-gold/5 border-gold/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
            <h2 className="text-4xl font-black mb-6 uppercase tracking-tighter italic">Ready for Your <span className="gold-text">Pilot?</span></h2>
            <p className="text-zinc-500 mb-12 max-w-lg mx-auto leading-loose font-medium uppercase tracking-[0.2em] text-xs">
              Join the 1,200+ brands using the AuthiChain protocol to eliminate counterfeiting and increase customer engagement by ~25%.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Link href="/" className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold">
                   Start Free Generation
                </Link>
                <Link href="/enterprise" className="btn-outline-gold px-12 py-5 font-black uppercase tracking-widest text-xs border-zinc-800">
                   Request Industrial Access
                </Link>
            </div>
        </div>
      </div>

      <footer className="py-20 border-t border-zinc-900 mt-20 opacity-30">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">AuthiChain Truth Network</p>
            <div className="flex gap-8 text-[9px] font-bold uppercase">
                <span>Terms</span>
                <span>Privacy</span>
                <span>DAO</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
