'use client';

import { useState } from 'react';
import {
  Shield,
  TrendingUp,
  Vote,
  Lock,
  BarChart3,
} from 'lucide-react';
import { ConnectButton } from 'thirdweb/react';
import { thirdwebClient, activeChain } from '@/lib/thirdweb';

export default function Governance() {
  const [stakedAmount] = useState('5,000');
  const [multiplier] = useState('1.5x');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleStake = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, duration_days: 180 }),
      });
      if (res.ok) alert('Successfully staked 1,000 $QRON');
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVote = async (proposalId: string) => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/governance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, vote_type: 'yes' }),
      });
      if (res.ok) alert(`Vote cast for ${proposalId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold uppercase tracking-widest mb-4">
              <Shield className="w-3 h-3" />
              GovChain.us — AuthiChain Ecosystem Governance
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 uppercase">
              The <span className="gold-text">Protocol</span> DAO
            </h1>
            <p className="text-zinc-500 text-lg leading-relaxed">
              Stake your $QRON to earn protocol fees, unlock premium brand
              discounts, and vote on the future of the visual internet.
            </p>
          </div>
          <div className="shrink-0">
            <ConnectButton
              client={thirdwebClient}
              chain={activeChain}
              connectButton={{
                label: 'Connect Wallet',
                style: {
                  background: 'linear-gradient(135deg, #c9a227, #a07c10)',
                  color: '#000',
                  fontWeight: 900,
                  borderRadius: '12px',
                  padding: '16px 32px',
                },
              }}
            />
          </div>
        </header>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Circulating Supply', val: '100,000,000', sub: '$QRON' },
            { label: 'Total Staked', val: '42,500,000', sub: '42.5%' },
            { label: 'Total Burned', val: '1,250,000', sub: 'Deflationary' },
            { label: 'Treasury Value', val: '$840,000', sub: 'USDT/ETH/QRON' },
          ].map((s) => (
            <div key={s.label} className="protocol-card p-6 border-zinc-900">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">
                {s.label}
              </p>
              <p className="text-2xl font-black text-white">{s.val}</p>
              <p className="text-xs font-bold text-gold/60">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Staking Panel */}
          <div className="lg:col-span-2 space-y-8">
            <div className="protocol-card p-8 border-gold/10 bg-gold/5">
              <div className="flex items-center gap-3 mb-8">
                <Lock className="w-5 h-5 text-gold" />
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
                  Staking & Rewards
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
                <div>
                  <label className="block text-xs font-black text-zinc-600 uppercase mb-4">
                    Staked Balance
                  </label>
                  <div className="text-5xl font-black gold-text leading-none mb-2">
                    {stakedAmount}
                  </div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                    Available to withdraw: 0.00
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-600 uppercase mb-4">
                    Voting Multiplier
                  </label>
                  <div className="text-5xl font-black text-white leading-none mb-2">
                    {multiplier}
                  </div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                    Based on 180 day lock
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleStake}
                  disabled={isActionLoading}
                  className="btn-gold flex-1 py-4 font-black uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {isActionLoading ? 'Processing...' : 'Stake $QRON'}
                </button>
                <button className="btn-outline-gold flex-1 py-4 font-black uppercase tracking-widest text-xs border-zinc-800">
                  Claim Rewards
                </button>
              </div>
            </div>

            {/* Active Proposals */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black uppercase tracking-tight">
                  Active Proposals
                </h2>
                <div className="h-px flex-1 bg-zinc-900 mx-6" />
                <button className="text-xs font-black text-gold uppercase tracking-widest hover:underline">
                  New Proposal
                </button>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: 'Allocate 1M QRON for Creator Grants',
                    id: 'PIP-042',
                    status: 'Active',
                    ends: '2d 4h',
                  },
                  {
                    title: 'Increase Protocol Burn from 20% to 25%',
                    id: 'PIP-043',
                    status: 'Active',
                    ends: '5d 12h',
                  },
                  {
                    title: 'Integrate Base L2 for On-Chain Provenance',
                    id: 'PIP-041',
                    status: 'Executed',
                    ends: 'Completed',
                  },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => p.status === 'Active' && handleVote(p.id)}
                    className={`protocol-card p-6 flex items-center justify-between group transition-all ${p.status === 'Active' ? 'hover:border-gold/30 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-black text-gold uppercase">
                          {p.id}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                          Ends in {p.ends}
                        </span>
                      </div>
                      <h3 className="font-bold text-zinc-200 group-hover:text-white">
                        {p.title}
                      </h3>
                    </div>
                    <Vote className={`w-5 h-5 transition-colors ${p.status === 'Active' ? 'text-zinc-800 group-hover:text-gold' : 'text-zinc-900'}`} />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="protocol-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-5 h-5 text-gold" />
                <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Yield Projection
                </h2>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-zinc-600 text-[10px] font-black uppercase mb-1">
                    Current APR
                  </p>
                  <p className="text-3xl font-black text-white">12.4%</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-zinc-500">
                    <span>Staker Share</span>
                    <span className="text-zinc-300">40% of all fees</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-zinc-500">
                    <span>Lock Duration</span>
                    <span className="text-zinc-300">Flexible - 365 Days</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="protocol-card p-8 bg-zinc-950">
              <BarChart3 className="w-6 h-6 text-gold mb-6" />
              <h3 className="font-black uppercase tracking-widest text-[10px] text-zinc-400 mb-4">
                Governance Rules
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                Governance is strictly enforced by the QRON Smart Contract on
                Polygon POS. Proposals require a minimum stake of 100,000 $QRON
                to initiate and a simple majority to execute.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
