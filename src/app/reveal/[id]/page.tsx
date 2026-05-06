'use client';

import { useEffect, useState, use } from 'react';
import { Shield, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface RevealPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dest?: string }>;
}

export default function RevealPage({ params, searchParams }: RevealPageProps) {
  const { id } = use(params);
  const { dest } = use(searchParams);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Cinematic countdown/loading
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsReady(true);
          return 100;
        }
        return prev + 1.5;
      });
    }, 50);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isReady && dest) {
      // Small delay before final redirect to let the 'Ready' state breathe
      const redirectTimer = setTimeout(() => {
        window.location.assign(dest);
      }, 1500);
      return () => clearTimeout(redirectTimer);
    }
  }, [isReady, dest]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute inset-0 bg-[url('/media/neon-matrix.svg')] opacity-[0.03] bg-repeat pointer-events-none" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-8 flex flex-col items-center text-center">
        {/* Protocol Seal */}
        <div className="mb-12 relative group">
          <div className="absolute inset-0 bg-gold/20 blur-2xl rounded-full scale-150 animate-pulse" />
          <div className="relative w-32 h-32 rounded-3xl border border-gold/30 bg-zinc-950 p-6 flex items-center justify-center shadow-2xl">
            <Shield className="w-16 h-16 text-gold animate-float" />
          </div>
        </div>

        {/* Narrative Text */}
        <div className="space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-[0.3em]">
            <Sparkles className="w-3 h-3" />
            Decrypting Digital Narrative
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">
            Authentic <span className="gold-text">Reveal</span>
          </h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest max-w-[280px]">
            Syncing on-chain metadata for artifact registry #{id.slice(0, 8)}
          </p>
        </div>

        {/* Cinematic Progress */}
        <div className="w-full space-y-6">
          <div className="relative h-1 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-gold/50 to-gold transition-all duration-100 ease-linear shadow-gold"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-3">
              {!isReady ? (
                <Loader2 className="w-4 h-4 text-zinc-700 animate-spin" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                {!isReady ? `Syncing ${Math.floor(progress)}%` : 'Ready for Navigation'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-800">
              PROTO-V{id.slice(0, 4).toUpperCase()}
            </span>
          </div>
        </div>

        {/* CTA (Appears when ready) */}
        <div className={`mt-16 transition-all duration-700 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <button className="btn-gold px-10 py-4 flex items-center gap-4 font-black uppercase tracking-widest text-[10px] shadow-gold group">
            Proceed to Destination
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="mt-4 text-zinc-600 text-[9px] font-bold uppercase tracking-widest">
            Automatic redirect in 1.5s
          </p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-20 grayscale grayscale-100">
        <Image src="/media/samples/01_flux_qron_space.png" alt="qron" width={24} height={24} />
        <span className="text-[10px] font-black uppercase tracking-widest">AuthiChain Protocol</span>
      </div>
    </div>
  );
}
