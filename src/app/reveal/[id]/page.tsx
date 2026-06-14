'use client';

import { useEffect, useState } from 'react';
import { Shield, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface RevealPageProps {
  params: { id: string };
  searchParams: { dest?: string };
}

export default function RevealPage({ params, searchParams }: RevealPageProps) {
  const { id } = params;
  const { dest } = searchParams;
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [redirectQueued, setRedirectQueued] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          window.clearInterval(timer);
          setIsReady(true);
          return 100;
        }
        return prev + 1.5;
      });
    }, 30);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isReady && dest && !redirectQueued) {
      setRedirectQueued(true);
      const redirectTimer = window.setTimeout(() => {
        window.location.assign(dest);
      }, 1200);
      return () => window.clearTimeout(redirectTimer);
    }
  }, [isReady, dest, redirectQueued]);

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

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest mb-8">
          <Sparkles className="w-3 h-3" />
          <span>Authenticity Verification</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">
          SECURE <span className="text-gold italic">ACCESS</span>
        </h1>
        
        <p className="text-zinc-500 mb-12 text-sm max-w-xs mx-auto leading-relaxed">
          Verifying cryptographic anchor for asset <span className="text-zinc-300 font-mono">#{id.slice(0, 8)}</span>
        </p>

        {/* Progress Bar */}
        <div className="w-full mb-12">
          <div className="flex justify-between text-[10px] font-bold text-zinc-600 mb-2 uppercase tracking-widest">
            <span>Synchronizing</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden p-[1px]">
            <div 
              className="h-full bg-gold rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(212,175,55,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Story Mode Status */}
        <div className="space-y-4">
          {isReady ? (
            <div className="p-6 rounded-3xl bg-zinc-950/70 border border-gold/15">
              <p className="text-sm font-black uppercase tracking-widest text-gold">Story Mode Ready</p>
              <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
                Your immersive reveal is complete.
                You will be redirected to the verified destination automatically.
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-zinc-950/70 border border-zinc-800/50">
              <p className="text-sm font-black uppercase tracking-widest text-zinc-300">Preparing the narrative</p>
              <p className="mt-3 text-zinc-500 text-sm leading-relaxed">
                Story Mode is loading the cinematic experience. Please hold on for a moment.
              </p>
            </div>
          )}

          {!dest && (
            <div className="p-6 rounded-3xl bg-red-900/20 border border-red-500/20">
              <p className="text-sm font-black uppercase tracking-widest text-red-300">
                No destination found
              </p>
              <p className="mt-3 text-red-200 text-sm leading-relaxed">
                The Story Mode reveal is active, but we could not locate the redirect target. Please return to the homepage and try again.
              </p>
            </div>
          )}
        </div>

        <div className="mt-12 flex items-center gap-6 opacity-30 grayscale">
          <Image src="/media/logo-white.svg" alt="Authichain" width={80} height={20} />
          <div className="w-px h-4 bg-zinc-800" />
          <span className="text-[10px] font-bold tracking-widest uppercase">Edge Verifier v2.4</span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
