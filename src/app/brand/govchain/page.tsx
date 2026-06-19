'use client';

import Link from 'next/link';
import { LeadCaptureForm } from '@/components/lead-capture-form';
import { useState } from 'react';
import {
  Vote, Shield, Zap, Lock, Users, TrendingUp,
  ArrowRight, CheckCircle, Coins, Scale, Globe, Activity,
} from 'lucide-react';

const BLUE = '#3b82f6';
const RED = '#ef4444';

const STATS = [
  { value: '4.2M', label: '$QRON Staked' },
  { value: '11.4%', label: 'Current APY' },
  { value: '23', label: 'Proposals Passed' },
  { value: '847', label: 'Active Voters' },
];

const PROPOSALS = [
  { id: 'GIP-024', title: 'Allocate 500K $QRON to AgTech Operator Grants', status: 'Active', votes: '68%', ends: '3 days' },
  { id: 'GIP-023', title: 'Add govchain.us to DHS SVIP Pilot Registry', status: 'Passed', votes: '91%', ends: 'Closed' },
  { id: 'GIP-022', title: 'Reduce generation fee for .gov domains to $0', status: 'Passed', votes: '84%', ends: 'Closed' },
];

const STEPS = [
  { n: '01', icon: Coins, title: 'Acquire $QRON', desc: 'Purchase $QRON on decentralized exchanges or earn it by generating authenticated products on the protocol.' },
  { n: '02', icon: Lock, title: 'Stake & Delegate', desc: 'Lock your $QRON in the governance vault. Choose a delegation tier: Observer, Delegate, or Guardian.' },
  { n: '03', icon: Vote, title: 'Vote on Proposals', desc: 'Voting power is proportional to staked balance. Submit Governance Improvement Proposals (GIPs) with 10,000 $QRON minimum.' },
  { n: '04', icon: TrendingUp, title: 'Earn Yield', desc: 'Stakers earn pro-rata yield from protocol fees. Current APY: 11.4%. Rewards distributed weekly on-chain.' },
];

const VERTICALS = [
  { icon: Globe, label: 'Federal Agencies', desc: 'Credential issuance and document authentication for .gov entities.', color: BLUE },
  { icon: Scale, label: 'Regulatory Bodies', desc: 'Immutable audit trails for regulatory filings, inspection certificates, and compliance documents.', color: '#8b5cf6' },
  { icon: Shield, label: 'Defense & Intelligence', desc: 'DHS SVIP-aligned protocols for supply chain security and materiel tracking.', color: RED },
  { icon: Users, label: 'Municipal Governments', desc: 'Business license authentication, permit issuance, and citizen credential management.', color: '#10b981' },
];

export default function GovChainHome() {
  const [stakeAmount, setStakeAmount] = useState(1000);
  const apy = 0.114;
  const weeklyYield = ((stakeAmount * apy) / 52).toFixed(2);
  const annualYield = (stakeAmount * apy).toFixed(2);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Vote className="w-6 h-6" style={{ color: BLUE }} />
          <span className="font-black text-xl tracking-tighter">GovChain</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">.us</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {[['Datalog', '/brand/govchain/datalog'], ['Proposals', '/governance/proposals'], ['Tokenomics', '/governance/tokenomics'], ['Docs', '/docs'], ['Verify', '/verify']].map(([label, href]) => (
            <Link key={label} href={href} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-blue-400 transition-colors">{label}</Link>
          ))}
        </div>
        <Link href="/governance" className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg border text-blue-400 hover:bg-blue-500/10 transition-all" style={{ borderColor: `${BLUE}40` }}>
          Enter DAO
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6">

        {/* Hero */}
        <section className="py-24 text-center relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.07)_0%,transparent_70%)]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest mb-8" style={{ borderColor: `${BLUE}30`, background: `${BLUE}08`, color: BLUE }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE }} />
              DAO Active · GIP-024 Voting Now
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
              Decentralized Governance<br />
              <span style={{ background: `linear-gradient(135deg, ${RED} 0%, #fff 50%, ${BLUE} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                for Digital Trust.
              </span>
            </h1>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              Stake $QRON. Vote on protocol upgrades and grant allocations. Earn yield. Shape the infrastructure that authenticates physical commerce worldwide.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/governance" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e40af 100%)` }}>
                <Vote className="w-4 h-4" /> Stake & Govern
              </Link>
              <Link href="/governance/proposals" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest border hover:bg-blue-500/10 transition-all flex items-center gap-2" style={{ borderColor: `${BLUE}30`, color: BLUE }}>
                <Activity className="w-4 h-4" /> View Proposals
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
          {STATS.map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center">
              <div className="text-3xl font-black mb-1" style={{ color: BLUE }}>{value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</div>
            </div>
          ))}
        </div>

        {/* Staking Calculator + Live Proposals */}
        <section className="mb-24 grid md:grid-cols-2 gap-8">

          {/* Calculator */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                <Coins className="w-5 h-5" style={{ color: BLUE }} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Yield Calculator</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">11.4% APY · Paid Weekly</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-3">
                $QRON to Stake: <span style={{ color: BLUE }}>{stakeAmount.toLocaleString()}</span>
              </label>
              <input
                type="range" min={100} max={100000} step={100}
                value={stakeAmount}
                onChange={e => setStakeAmount(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[9px] text-zinc-700 font-bold mt-1">
                <span>100</span><span>100,000</span>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Weekly Yield', value: `${weeklyYield} $QRON` },
                { label: 'Annual Yield', value: `${annualYield} $QRON` },
                { label: 'Current APY', value: '11.4%' },
                { label: 'Lock Period', value: 'None (liquid)' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-zinc-900">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
                  <span className="text-xs font-black text-white">{value}</span>
                </div>
              ))}
            </div>

            <Link href="/governance" className="mt-6 w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest text-white text-center block" style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e40af 100%)` }}>
              Stake Now →
            </Link>
          </div>

          {/* Proposals */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Active Proposals</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Governance Improvement Proposals</p>
              </div>
              <Link href="/governance/proposals" className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:underline flex items-center gap-1">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {PROPOSALS.map(({ id, title, status, votes, ends }) => (
                <div key={id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[9px] font-black text-zinc-600 font-mono">{id}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      status === 'Active'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}>{status}</span>
                  </div>
                  <p className="text-xs font-bold text-white mb-3 leading-snug">{title}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-800 mr-3">
                      <div className="h-1.5 rounded-full" style={{ width: votes, background: status === 'Active' ? BLUE : '#10b981' }} />
                    </div>
                    <span className="text-[9px] font-black text-zinc-500">{votes} · {ends}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: BLUE }}>DAO Mechanics</span>
            <h2 className="text-4xl font-black tracking-tighter">How GovChain Works</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, title, desc, icon: Icon }) => (
              <div key={n} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-black font-mono" style={{ color: BLUE }}>{n}</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                    <Icon className="w-5 h-5" style={{ color: BLUE }} />
                  </div>
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Government Verticals */}
        <section className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: BLUE }}>Institutional Use</span>
            <h2 className="text-4xl font-black tracking-tighter">Built for Government at Every Level</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VERTICALS.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 hover:border-zinc-700 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-2">{label}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Lead Capture */}
        <section className="mb-24">
          <LeadCaptureForm
            domain="govchain"
            headline="Build Sustainable DAOs"
            subheadline="Governance infrastructure with multi-sig voting and staking rewards."
            cta="Enter the DAO"
          />
        </section>

        {/* CTA */}
        <section className="mb-24 rounded-3xl text-center py-20 px-8 relative overflow-hidden border" style={{ borderColor: `${BLUE}20`, background: 'linear-gradient(135deg, #040a18 0%, #0a0a0a 50%, #04081a 100%)' }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${BLUE}08 0%, transparent 60%)` }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest" style={{ borderColor: `${RED}30`, background: `${RED}08`, color: RED }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: RED }} />
              GIP-024 Closes in 3 Days
            </div>
            <h2 className="text-4xl font-black tracking-tighter mb-4">Your Vote Shapes the Protocol</h2>
            <p className="text-zinc-400 mb-10 max-w-md mx-auto">Every $QRON staked is a voice in how authentication infrastructure evolves. Join 847 active voters.</p>
            <Link href="/governance" className="px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white inline-flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e40af 100%)` }}>
              <Vote className="w-4 h-4" /> Enter the DAO
            </Link>
          </div>
        </section>

        {/* Ecosystem */}
        <section className="mb-16">
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-700 mb-8">The AuthiChain Ecosystem</p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'AuthiChain.com', desc: 'Enterprise Auth Protocol', url: 'https://authichain.com', color: '#c9a227' },
              { name: 'QRON.space', desc: 'AI QR Art Studio', url: 'https://qron.space', color: '#8b5cf6' },
              { name: 'StrainChain.io', desc: 'Cannabis Provenance', url: 'https://strainchain.io', color: '#10b981' },
            ].map(({ name, desc, url, color }) => (
              <a key={name} href={url} className="px-5 py-3 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors bg-zinc-950 flex flex-col items-start gap-0.5">
                <span className="text-xs font-black" style={{ color }}>{name}</span>
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{desc}</span>
              </a>
            ))}
          </div>
        </section>

        <footer className="text-center py-10 border-t border-zinc-900">
          <div className="flex justify-center gap-6 mb-4">
            {[['Terms', '/terms'], ['Privacy', '/privacy'], ['Tokenomics', '/governance/tokenomics'], ['Affiliates', '/affiliate'], ['Status', '/status']].map(([label, href]) => (
              <Link key={label} href={href} className="text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">{label}</Link>
            ))}
          </div>
          <p className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">
            GovChain.us · AuthiChain Protocol · DAO Governed · © 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
