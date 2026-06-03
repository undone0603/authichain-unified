'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Activity } from 'lucide-react';

interface TruthSealProps {
  productId: number;
  className?: string;
  theme?: 'dark' | 'light';
}

/**
 * AuthiChain React Truth SDK
 * 
 * Usage:
 * <TruthSeal productId={123} />
 */
export default function TruthSeal({ productId, className = '', theme = 'dark' }: TruthSealProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/v1/seal/${productId}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('TruthSeal fetch failed', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, [productId]);

  if (loading) return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-black/20 animate-pulse ${className}`}>
      <div className="w-2 h-2 rounded-full bg-zinc-800" />
      <div className="h-2 w-16 bg-zinc-800 rounded" />
    </div>
  );

  if (!data || data.status !== 'VERIFIED') return null;

  return (
    <a 
      href={data.sealUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center gap-3 px-4 py-2 rounded-xl border transition-all active:scale-95
        ${theme === 'dark' 
          ? 'bg-black text-white border-white/10 hover:border-gold/40' 
          : 'bg-white text-black border-black/10 hover:border-gold/40'
        }
        ${className}
      `}
    >
      <div className="relative">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-widest leading-none">
          <span className="text-gold mr-1">{data.brand}</span>
          Verified
        </span>
        <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-tighter mt-0.5">
          AuthiChain Protocol v2.4
        </span>
      </div>
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-1" />
    </a>
  );
}
