'use client';

import { useEffect, useState, use } from 'react';
import { Shield, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { startAuthentication } from '@simplewebauthn/browser';

interface RevealPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dest?: string }>;
}

export default function RevealPage({ params, searchParams }: RevealPageProps) {
  const { id } = use(params);
  const { dest } = use(searchParams);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

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
    }, 30);

    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const challengeResp = await fetch('https://api.authichain.com/generate-challenge');
      const options = await challengeResp.json();
      
      const authResp = await startAuthentication(options);
      
      const verifyResp = await fetch('https://api.authichain.com/verify-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp),
      });

      if (verifyResp.ok) {
        setIsVerified(true);
      }
    } catch (err) {
      console.error('Verification failed', err);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (isReady && dest && isVerified) {
      const redirectTimer = setTimeout(() => {
        window.location.assign(dest);
      }, 1500);
      return () => clearTimeout(redirectTimer);
    }
  }, [isReady, dest, isVerified]);

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

        {/* Action Button */}
        {isReady && !isVerified && (
          <button 
            onClick={handleVerify}
            disabled={isVerifying}
            className="group relative w-full py-4 bg-gold text-black font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-3">
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <span>Verify Authenticity</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        )}

        {isVerified && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-gold font-bold">
              <Shield className="w-5 h-5" />
              Authenticity Anchored
            </div>
            <p className="text-zinc-500 text-xs">Redirecting to verified destination...</p>
          </div>
        )}

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
