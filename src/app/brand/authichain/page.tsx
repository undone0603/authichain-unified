'use client';

import Link from 'next/link';
import { LeadCaptureForm } from '@/components/lead-capture-form';
import {
  Shield, Zap, Lock, Package, Globe, Activity,
  ArrowRight, CheckCircle, Code2, Building2, Pill,
  ShieldCheck, Leaf, Vote, Sparkles, Terminal,
} from 'lucide-react';

const STATS = [
  { value: '10+', label: 'Industry Verticals' },
  { value: 'Ed25519', label: 'Cryptographic Standard' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '< 3s', label: 'Verification Time' },
];

const USE_CASES = [
  { icon: Sparkles, label: 'Luxury Goods', desc: 'Authenticate handbags, watches, and jewelry with scannable certificates that outlast the product lifecycle.', color: '#c9a227' },
  { icon: Pill, label: 'Pharma & Biotech', desc: 'Track chain of custody from manufacture to dispensary. Immutable provenance for regulated substances.', color: '#60a5fa' },
  { icon: Leaf, label: 'AgTech & Cannabis', desc: 'Seed-to-sale compliance. Genetic mapping. State-by-state regulatory alignment via StrainChain.', color: '#10b981' },
  { icon: Building2, label: 'Real Estate', desc: 'Title deed anchoring, inspection certificates, and property identity on Polygon.', color: '#a78bfa' },
  { icon: Globe, label: 'Government', desc: 'DHS SVIP-aligned digital credential issuance. FTC Shield compliance for .gov and .us domains.', color: '#3b82f6' },
  { icon: Package, label: 'Retail & Events', desc: 'Anti-counterfeiting at scale. NFT-backed loyalty programs. Dynamic QR codes that update post-print.', color: '#f59e0b' },
];

const STEPS = [
  { n: '01', title: 'Issue Identity', desc: 'Your product, document, or artifact receives an Ed25519 keypair. The public key is embedded into a QRON — scannable AI art.', icon: Shield },
  { n: '02', title: 'Anchor On-Chain', desc: 'An ERC-721 certificate is minted on Polygon with the product\'s metadata, provenance data, and cryptographic proof of origin.', icon: Lock },
  { n: '03', title: 'Verify Anywhere', desc: 'Any camera app scans the QRON. The AuthiChain protocol resolves the payload, verifies the signature, and returns a trust score in < 3s.', icon: ShieldCheck },
  { n: '04', title: 'Analytics & Control', desc: 'Track every scan — time, location, device. Receive geo-fence alerts, rotate keys, and update product narratives without reprinting.', icon: Activity },
];

export default function AuthiChainHome() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[#c9a227]" />
          <span className="font-black text-xl tracking-tighter">AuthiChain</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">Protocol</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {[['Docs', '/docs'], ['API', '/docs'], ['Enterprise', '/enterprise'], ['Verify', '/verify']].map(([label, href]) => (
            <Link key={label} href={href} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-[#c9a227] transition-colors">{label}</Link>
          ))}
        </div>
        <Link href="/login" className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg border border-[#c9a227]/30 text-[#c9a227] hover:bg-[#c9a227]/10 transition-all">
          Sign In
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6">

        {/* Hero */}
        <section className="py-24 text-center relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,162,39,0.07)_0%,transparent_70%)]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#c9a227]/20 bg-[#c9a227]/5 text-[10px] font-black uppercase tracking-widest text-[#c9a227] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-pulse" />
              Protocol Live · Polygon Mainnet
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
              The Authentication Stack<br />
              <span style={{ background: 'linear-gradient(135deg, #e8c547 0%, #c9a227 50%, #a07d10 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                for Physical Commerce.
              </span>
            </h1>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              Ed25519-signed product identities anchored on Polygon. Scannable by any phone. Verifiable by anyone. Counterfeit-proof by design.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/enterprise" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-black flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #e8c547 0%, #c9a227 100%)' }}>
                <Shield className="w-4 h-4" /> Start Enterprise Trial
              </Link>
              <Link href="/docs" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-[#c9a227] border border-[#c9a227]/30 hover:bg-[#c9a227]/10 transition-all flex items-center gap-2">
                <Code2 className="w-4 h-4" /> View API Docs
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
          {STATS.map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center">
              <div className="text-3xl font-black text-[#c9a227] mb-1">{value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</div>
            </div>
          ))}
        </div>

        {/* Problem */}
        <section className="mb-24 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block mb-4">The Problem</span>
              <h2 className="text-4xl font-black tracking-tighter mb-6">
                <span className="text-red-400">$2.3 Trillion</span> in counterfeit goods enter global commerce every year.
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Existing solutions — holograms, serial numbers, certificates of authenticity — are trivially forged. They rely on trust in a document, not in cryptographic proof.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                AuthiChain replaces paper certificates with cryptographic identity anchored on a public blockchain. The truth is not in a database you control. It&apos;s in math.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Hologram labels', pct: 12, color: '#ef4444' },
                { label: 'Serial number lookups', pct: 28, color: '#f97316' },
                { label: 'AuthiChain QRON', pct: 100, color: '#c9a227' },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs font-black mb-2">
                    <span className="text-zinc-400 uppercase tracking-widest">{label}</span>
                    <span style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-900">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest pt-2">Verification reliability vs. common alternatives</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] block mb-3">Protocol Architecture</span>
            <h2 className="text-4xl font-black tracking-tighter">How AuthiChain Works</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, title, desc, icon: Icon }) => (
              <div key={n} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-black text-[#c9a227] font-mono">{n}</span>
                  <div className="w-10 h-10 rounded-xl bg-[#c9a227]/10 border border-[#c9a227]/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#c9a227]" />
                  </div>
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 text-white">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] block mb-3">Industry Coverage</span>
            <h2 className="text-4xl font-black tracking-tighter">Built for Every Vertical</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {USE_CASES.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 hover:border-zinc-700 transition-colors group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">{label}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* API Teaser */}
        <section className="mb-24 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#c9a227]/20 bg-[#c9a227]/5 text-[10px] font-black uppercase tracking-widest text-[#c9a227] mb-6">
                <Terminal className="w-3 h-3" /> Developer API
              </div>
              <h2 className="text-4xl font-black tracking-tighter mb-6">Built for Builders</h2>
              <p className="text-zinc-400 leading-relaxed mb-8">
                REST API, webhooks, and SDKs for JavaScript, Python, and Go. Issue certificates, verify QRONs, and query the on-chain ledger in minutes.
              </p>
              <div className="flex gap-4">
                <Link href="/docs" className="flex items-center gap-2 text-[#c9a227] text-xs font-black uppercase tracking-widest hover:underline">
                  Read the Docs <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-black border border-zinc-800 p-6 font-mono text-sm overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="text-xs text-zinc-600 ml-2">verify.ts</span>
              </div>
              <pre className="text-xs leading-relaxed text-zinc-300 overflow-x-auto">{`const result = await authichain.verify({
  qronId: "qrn_8xKm2pL9vNq",
  checkChain: true,
});

// result
{
  valid: true,
  score: 0.998,
  chain: "polygon",
  mintedAt: "2026-04-21T12:00:00Z",
  owner: "0xAebf...E437",
}`}</pre>
            </div>
          </div>
        </section>

        {/* Lead Capture */}
        <section className="mb-24">
          <LeadCaptureForm
            domain="authichain"
            headline="Secure Your Digital Credentials"
            subheadline="Enterprise-grade authentication powered by blockchain. Talk to our team."
            cta="Request Access"
          />
        </section>

        {/* CTA */}
        <section className="mb-24 rounded-3xl text-center py-20 px-8 relative overflow-hidden border border-[#c9a227]/20" style={{ background: 'linear-gradient(135deg, #111100 0%, #0d0d0d 50%, #110d00 100%)' }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,162,39,0.08)_0%,transparent_60%)]" />
          <div className="relative z-10">
            <h2 className="text-4xl font-black tracking-tighter mb-4">Ready to Authenticate?</h2>
            <p className="text-zinc-400 mb-10 max-w-md mx-auto">Talk to the team. We scope, price, and integrate in under 2 weeks for most enterprise clients.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/enterprise" className="px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-black flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #e8c547 0%, #c9a227 100%)' }}>
                <Shield className="w-4 h-4" /> Start Enterprise Trial
              </Link>
              <Link href="/contact" className="px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-[#c9a227] border border-[#c9a227]/30 hover:bg-[#c9a227]/10 transition-all">
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

        {/* Ecosystem */}
        <section className="mb-16">
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-700 mb-8">The AuthiChain Ecosystem</p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'QRON.space', desc: 'AI QR Art Studio', url: 'https://qron.space', color: '#c9a227' },
              { name: 'StrainChain.io', desc: 'Cannabis Provenance', url: 'https://strainchain.io', color: '#10b981' },
              { name: 'GovChain.us', desc: 'DAO Governance', url: 'https://govchain.us', color: '#3b82f6' },
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
            {[['Terms', '/terms'], ['Privacy', '/privacy'], ['Docs', '/docs'], ['Affiliates', '/affiliate'], ['Status', '/status']].map(([label, href]) => (
              <Link key={label} href={href} className="text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">{label}</Link>
            ))}
          </div>
          <p className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">
            AuthiChain Protocol · Polygon Mainnet · Ed25519 · © 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
