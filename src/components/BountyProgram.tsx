'use client';

import { useState } from 'react';
import { ShieldAlert, Trophy, Coins, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export function BountyProgram() {
  const [isJoined, setIsReady] = useState(false);

  return (
    <div className="protocol-card bg-zinc-950/50 border-zinc-900 p-8 md:p-12 overflow-hidden relative group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
      
      <div className="flex flex-col md:flex-row gap-12 items-center relative z-10">
        <div className="flex-1 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest mb-6">
            <ShieldAlert className="w-3 h-3" />
            Active Incentive Layer
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 italic">
            Counterfeit <span className="gold-text">Bounties</span>
          </h2>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest leading-loose mb-8 max-w-xl">
            Help the AuthiChain protocol secure the marketplace. Report counterfeit items, provide forensic proof, and claim rewards locked by brands in USDC or $QRON.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {[
              { icon: Coins, label: 'Verified Payouts', val: 'Up to $5,000' },
              { icon: Lock, label: 'Locked on Polygon', val: 'Smart Contract Escrow' },
            ].map((item) => (
              <div key={item.label} className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                <div className="flex items-center gap-3 mb-2">
                  <item.icon className="w-4 h-4 text-gold" />
                  <span className="text-[10px] font-black uppercase text-zinc-500">{item.label}</span>
                </div>
                <p className="text-lg font-black text-white">{item.val}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setIsReady(true)}
              className="btn-gold px-8 py-4 flex items-center gap-3 font-black uppercase tracking-widest text-[10px]"
            >
              {isJoined ? 'Enrolled in Program' : 'Become a Bounty Hunter'}
              {isJoined ? <CheckCircle className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
            </button>
            <Link href="/docs/bounties" className="px-8 py-4 border border-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-gold/50 transition-colors">
              Read Rules
            </Link>
          </div>
        </div>

        <div className="w-full md:w-80 aspect-[4/5] bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
              <Coins className="w-6 h-6 text-gold" />
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black text-zinc-600 uppercase">Vault Balance</p>
              <p className="text-sm font-mono font-black text-white">$142,400.00</p>
            </div>
          </div>
          
          <div className="space-y-4 mb-auto">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Recent Claims</div>
            {[
              { id: 'AC-9921', brand: 'Rolex', amount: '250 $QRON' },
              { id: 'AC-1044', brand: 'Nike', amount: '50 USDC' },
              { id: 'AC-8821', brand: 'BMW', amount: '500 $QRON' },
            ].map((claim) => (
              <div key={claim.id} className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-white">{claim.id}</p>
                  <p className="text-[8px] font-bold text-zinc-600 uppercase">{claim.brand}</p>
                </div>
                <div className="text-[10px] font-mono font-black text-green-500">+{claim.amount}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-800">
             <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-black text-zinc-500 uppercase">Live Protocol Feed</span>
             </div>
             <p className="text-[9px] font-medium text-zinc-400 italic">"New bounty locked for Rolex Cosmograph #8812... awaiting verification."</p>
          </div>
        </div>
      </div>
    </div>
  );
}
