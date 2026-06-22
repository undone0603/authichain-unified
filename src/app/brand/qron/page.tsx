'use client';

import Link from 'next/link';
import { Sparkles, Zap, Eye, TrendingUp, ArrowRight } from 'lucide-react';

const PURPLE = '#8b5cf6';
const PINK = '#ec4899';

export default function QRONHome() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6" style={{ color: PURPLE }} />
          <span className="font-black text-xl tracking-tighter">QRON</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">.space</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {[['Gallery', '/brand/qron/gallery'], ['How It Works', '#how'], ['Pricing', '#pricing']].map(([label, href]) => (
            <a key={label} href={href} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-purple-400 transition-colors">{label}</a>
          ))}
        </div>
        <Link href="/brand/qron/gallery" className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg border hover:bg-purple-500/10 transition-all" style={{ borderColor: `${PURPLE}40`, color: PURPLE }}>
          Explore
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6">
        {/* Hero */}
        <section className="py-24 text-center relative">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${PURPLE}08 0%, transparent 70%)` }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest mb-8" style={{ borderColor: `${PURPLE}30`, background: `${PURPLE}08`, color: PURPLE }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PURPLE }} />
              AI QR Art · 100% Scannable · Real-Time Analytics
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
              Scannable<br />
              <span style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, ${PINK} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                AI Art.
              </span>
            </h1>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              Transform functional QR codes into stunning, branded artwork. Every QRON code is fully scannable and visually unique.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/brand/qron/gallery" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, ${PINK} 100%)` }}>
                <Sparkles className="w-4 h-4" /> Explore Gallery
              </Link>
              <Link href="#" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest border hover:bg-purple-500/10 transition-all flex items-center gap-2" style={{ borderColor: `${PURPLE}30`, color: PURPLE }}>
                <Zap className="w-4 h-4" /> Create Your Own
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="how" className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: PURPLE }}>Why QRON</span>
            <h2 className="text-4xl font-black tracking-tighter">The Power of Artistic QR Codes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${PURPLE}15`, border: `1px solid ${PURPLE}30` }}>
                <Sparkles className="w-5 h-5" style={{ color: PURPLE }} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-3">AI Generated</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Unique artwork for every QR code, styled to match your brand identity</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${PINK}15`, border: `1px solid ${PINK}30` }}>
                <Eye className="w-5 h-5" style={{ color: PINK }} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-3">100% Scannable</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">All QRON codes scan reliably across all devices and platforms</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: '#8b5cf615', border: `1px solid #8b5cf630` }}>
                <TrendingUp className="w-5 h-5" style={{ color: '#8b5cf6' }} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-3">Real-Time Analytics</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Track scans, engagement, and location data in real-time</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: PURPLE }}>Monetization</span>
            <h2 className="text-4xl font-black tracking-tighter">Multiple Revenue Streams</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">Reseller Program</h3>
              <p className="text-sm text-zinc-400 mb-6">Become a QRON reseller for print shops and agencies</p>
              <div className="text-3xl font-black mb-6">30%<span className="text-lg text-zinc-500"> margin</span></div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li>✓ Per-scan revenue share</li>
                <li>✓ White-label option</li>
                <li>✓ Dedicated support</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">Scan Analytics</h3>
              <p className="text-sm text-zinc-400 mb-6">Monetize through per-scan metering</p>
              <div className="text-3xl font-black mb-6">$0.001<span className="text-lg text-zinc-500">-$0.01</span></div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li>✓ SaaS billing model</li>
                <li>✓ Real-time dashboards</li>
                <li>✓ API access</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">White-Label</h3>
              <p className="text-sm text-zinc-400 mb-6">Full platform customization</p>
              <div className="text-3xl font-black mb-6">Custom<span className="text-lg text-zinc-500"> pricing</span></div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li>✓ Branded interface</li>
                <li>✓ Custom integrations</li>
                <li>✓ Enterprise support</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-24 rounded-3xl text-center py-20 px-8 relative overflow-hidden border" style={{ borderColor: `${PURPLE}20`, background: 'linear-gradient(135deg, #2a0f4a 0%, #0a0a0a 50%, #0a0a0a 100%)' }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${PURPLE}08 0%, transparent 60%)` }} />
          <div className="relative z-10">
            <h2 className="text-4xl font-black tracking-tighter mb-4">Create Your First QRON</h2>
            <p className="text-zinc-400 mb-10 max-w-md mx-auto">Turn your QR codes into art. Start creating stunning, scannable designs today.</p>
            <Link href="/brand/qron/gallery" className="px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white inline-flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, ${PINK} 100%)` }}>
              <Sparkles className="w-4 h-4" /> Explore Gallery
            </Link>
          </div>
        </section>

        <footer className="text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">
            QRON.space · AI QR Art Studio · © 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
