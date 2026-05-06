import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Shield, 
  Smartphone, 
  Zap, 
  Lock, 
  Activity, 
  Download,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  LayoutGrid
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'QRON Elite | Industrial Mobile Node',
  description: 'The premier mobile application for real-time product authentication, industrial telemetry, and AI QR generation.',
};

export default function EliteAppPage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden selection:bg-gold selection:text-black">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] bg-gold/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-zinc-900 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Nav */}
        <header className="flex justify-between items-center mb-24 border-b border-zinc-900 pb-8">
            <Link href="/" className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-gold" />
                <span className="text-xl font-black gold-text uppercase italic">Elite</span>
            </Link>
            <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <Link href="/enterprise" className="hover:text-gold transition-colors">Enterprise</Link>
                <Link href="/docs" className="hover:text-gold transition-colors">SDK</Link>
            </div>
        </header>

        {/* Hero */}
        <div className="flex flex-col lg:flex-row items-center gap-20 mb-32">
            <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                    <Smartphone className="w-3.5 h-3.5" />
                    Mobile Distribution Phase 1.0
                </div>
                <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter mb-8">
                    PROTOCOL IN <br /> YOUR <span className="gold-text">POCKET.</span>
                </h1>
                <p className="text-zinc-500 text-lg md:text-xl font-medium uppercase tracking-widest max-w-xl leading-relaxed mb-12">
                    The QRON Elite app turns any smartphone into an industrial-grade authentication node. Secure your supply chain from anywhere.
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start">
                    <div className="px-8 py-4 rounded-xl bg-zinc-900 border border-zinc-800 opacity-50 cursor-not-allowed flex items-center gap-4">
                        <div className="text-left">
                            <p className="text-[8px] font-black text-zinc-600 uppercase">Coming Soon to</p>
                            <p className="text-xs font-black text-zinc-400 uppercase">App Store</p>
                        </div>
                    </div>
                    <div className="px-8 py-4 rounded-xl bg-zinc-900 border border-zinc-800 opacity-50 cursor-not-allowed flex items-center gap-4">
                        <div className="text-left">
                            <p className="text-[8px] font-black text-zinc-600 uppercase">Coming Soon to</p>
                            <p className="text-xs font-black text-zinc-400 uppercase">Google Play</p>
                        </div>
                    </div>
                </div>
                <p className="mt-6 text-[10px] font-black text-gold uppercase tracking-widest">
                    â—† JOIN 14,000+ ON THE WAITLIST
                </p>
            </div>

            {/* Phone Mockup */}
            <div className="flex-1 flex justify-center">
                <div className="relative w-[320px] aspect-[9/19] bg-[#050505] rounded-[3rem] border-[10px] border-zinc-800 shadow-[0_0_100px_rgba(201,162,39,0.15)] ring-1 ring-zinc-700/50">
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-b-2xl z-20" />
                     <div className="p-8 h-full flex flex-col pt-16">
                         <div className="protocol-card p-4 mb-6 border-gold/20 bg-gold/5">
                             <div className="flex justify-between items-center mb-4">
                                 <Activity className="w-4 h-4 text-gold" />
                                 <span className="text-[8px] font-black text-zinc-500 uppercase">Node: Active</span>
                             </div>
                             <p className="text-[10px] font-bold text-white uppercase mb-1">BMW-BAT-992</p>
                             <p className="text-[14px] font-black text-gold tracking-tight">VERIFIED AUTHENTIC</p>
                         </div>
                         <div className="grid grid-cols-2 gap-3 mb-6">
                             {[1,2,3,4].map(i => (
                                 <div key={i} className="aspect-square rounded-xl bg-zinc-900 border border-zinc-800/50 animate-pulse" />
                             ))}
                         </div>
                         <div className="mt-auto p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                                     <Sparkles className="w-4 h-4 text-gold" />
                                 </div>
                                 <div className="flex-1 h-2 bg-zinc-800 rounded-full" />
                             </div>
                         </div>
                     </div>
                </div>
            </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-32">
            {[
                {
                    title: 'Native Generation',
                    desc: 'Generate scannable masterpieces with zero lag. Optimized for mobile GPU acceleration.',
                    icon: Zap
                },
                {
                    title: 'Industrial Scanning',
                    desc: 'Advanced computer vision optimized for low-light and damaged packaging.',
                    icon: LayoutGrid
                },
                {
                    title: 'Push Anomalies',
                    desc: 'Receive instant push notifications if your industrial assets are scanned in foreign regions.',
                    icon: Lock
                }
            ].map((f, i) => (
                <div key={i} className="protocol-card p-10 bg-zinc-950/50 border-zinc-900 group hover:border-gold/30 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-gold mb-8 group-hover:scale-110 transition-transform">
                        <f.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-white mb-4">{f.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed uppercase font-medium tracking-tighter">
                        {f.desc}
                    </p>
                </div>
            ))}
        </div>

        {/* Waitlist Call */}
        <div className="protocol-card p-12 md:p-24 text-center bg-gold/5 border-gold/10 relative">
            <h2 className="text-4xl md:text-5xl font-black mb-8 uppercase tracking-tighter italic text-white">SECURE YOUR <span className="gold-text underline underline-offset-8">INVITE</span></h2>
            <div className="max-w-md mx-auto flex flex-col sm:flex-row gap-4">
                <input 
                    type="email" 
                    placeholder="PROTOCOL@ENTERPRISE.COM"
                    className="flex-1 bg-black border border-zinc-800 rounded-xl px-6 py-4 text-xs font-black uppercase tracking-widest text-gold outline-none focus:border-gold/50 transition-all"
                />
                <button className="btn-gold px-10 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-gold">
                    JOIN PHASE 1
                </button>
            </div>
            <p className="mt-8 text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em]">
                AuthiChain Mobile Distribution Protocol v1.4.2
            </p>
        </div>
      </div>

      <footer className="py-20 border-t border-zinc-900 mt-20 opacity-30">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] tracking-widest">AuthiChain &copy; 2026</p>
            <div className="flex gap-8 text-[9px] font-bold uppercase">
                <span>iOS</span>
                <span>Android</span>
                <span>Waitlist Status</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
