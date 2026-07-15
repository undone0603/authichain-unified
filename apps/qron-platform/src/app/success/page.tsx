'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Zap,
  Mail,
  ArrowRight,
  Sparkles,
  RefreshCcw,
} from 'lucide-react';

function SuccessContent() {
  const [step, setStep] = useState(0);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1000);
    const t2 = setTimeout(() => setStep(2), 2500);
    const t3 = setTimeout(() => setStep(3), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const steps = [
    { icon: <Sparkles className="w-5 h-5" />, label: 'Crafting AI QR Art' },
    { icon: <RefreshCcw className="w-5 h-5" />, label: 'Initializing Living Portal' },
    { icon: <Mail className="w-5 h-5" />, label: 'Finalizing Delivery Sequence' },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 selection:bg-gold selection:text-black">
      <div className="max-w-xl w-full text-center">
        <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 bg-gold blur-3xl opacity-20 animate-pulse" />
            <div className="relative p-6 rounded-full bg-gold/10 border border-gold/20">
                <ShieldCheck className="w-16 h-16 text-gold" />
            </div>
        </div>
        
        <h1 className="text-4xl font-black gold-text mb-4 uppercase tracking-tighter">
          ORDER ACTIVATED
        </h1>
        <p className="text-zinc-500 text-sm font-medium mb-12 uppercase tracking-[0.3em]">
          Protocol Handshake Successful
        </p>

        {/* Process Visualizer */}
        <div className="protocol-card p-10 mb-8 text-left space-y-6">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-6 group">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700 ${
                  step > i
                    ? 'bg-gold text-black rotate-[360deg] shadow-gold'
                    : step === i
                    ? 'bg-zinc-800 text-gold animate-spin-slow border border-gold/40'
                    : 'bg-zinc-900 text-zinc-700 border border-zinc-800'
                }`}
              >
                {step > i ? <ShieldCheck className="w-6 h-6" /> : s.icon}
              </div>
              <div>
                <p
                  className={`text-sm font-black uppercase tracking-widest transition-colors duration-500 ${
                    step >= i ? 'text-white' : 'text-zinc-700'
                  }`}
                >
                  {s.label}
                </p>
                {step > i && (
                  <p className="text-[10px] font-bold text-gold/60 uppercase tracking-tighter mt-1">
                    Verified ◆ Success
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Info Card */}
        <div className="protocol-card p-8 bg-gold/5 border-gold/10 text-left mb-12">
          <h3 className="text-xs font-black uppercase tracking-widest text-gold mb-6 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Next Steps
          </h3>
          <ul className="space-y-4">
            {[
              { t: 'Secure Email', d: 'Your high-res asset link arrives in ~90s.' },
              { t: 'Shortcode URL', d: 'Your dynamic redirect is now active.' },
              { t: 'Registry Sync', d: 'Added to your dashboard library.' },
            ].map(item => (
              <li key={item.t} className="flex gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-gold/40 mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-zinc-300 uppercase">{item.t}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/dashboard"
            className="btn-gold px-10 py-4 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 flex-1 shadow-gold"
          >
            Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="btn-outline-gold px-10 py-4 font-black uppercase tracking-widest text-xs border-zinc-800 flex-1"
          >
            New Generation
          </Link>
        </div>

        {sessionId && (
          <p className="text-[9px] font-black text-zinc-800 uppercase tracking-widest mb-4">
            REF: {sessionId.toUpperCase()}
          </p>
        )}
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          Support: <a href="mailto:ops@qron.space" className="text-zinc-500 hover:text-gold transition-colors">ops@qron.space</a>
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SuccessContent />
    </Suspense>
  );
}
