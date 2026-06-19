'use client';

import Link from 'next/link';
import { Mail, Zap, Check, Barcode, Lock, TrendingUp, ArrowRight, Shield } from 'lucide-react';

const BLUE = '#3b82f6';
const PURPLE = '#8b5cf6';

export default function QRONPostmaster() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6" style={{ color: BLUE }} />
          <span className="font-black text-xl tracking-tighter">QRON Postmaster</span>
        </div>
        <Link href="/brand/qron" className="text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg border hover:bg-blue-500/10 transition-all" style={{ borderColor: `${BLUE}40`, color: BLUE }}>
          Back
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6">
        {/* Hero */}
        <section className="py-24 text-center relative">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${BLUE}08 0%, transparent 70%)` }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest mb-8" style={{ borderColor: `${BLUE}30`, background: `${BLUE}08`, color: BLUE }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE }} />
              QRON Stamps · Mail Verification · Postal Innovation
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
              Every Letter.<br />
              <span style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e40af 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Verified & Tracked.
              </span>
            </h1>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              QRON stamps revolutionize postal verification. Every piece of mail gets a unique, scannable QRON stamp that proves authenticity and enables real-time tracking.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="#features" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e40af 100%)` }}>
                <Mail className="w-4 h-4" /> Learn More
              </Link>
              <Link href="#pricing" className="px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest border hover:bg-blue-500/10 transition-all flex items-center gap-2" style={{ borderColor: `${BLUE}30`, color: BLUE }}>
                <Zap className="w-4 h-4" /> Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Problem & Solution */}
        <section className="mb-24 grid md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">Mail Fraud is Costing Billions</h2>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-xs font-black">!</span>
                <span>Check and mail theft costs USPS $2.7B annually</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-xs font-black">!</span>
                <span>Counterfeit stamps and forgeries widespread</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-xs font-black">!</span>
                <span>No real-time verification for high-value mail</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-xs font-black">!</span>
                <span>Tracking is manual and unreliable</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">QRON Postmaster Solution</h2>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Unique QRON stamp on every piece of mail</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Scannable QR codes prevent counterfeiting</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Real-time postal tracking for high-value items</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Blockchain-verified mail authenticity</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: BLUE }}>Features</span>
            <h2 className="text-4xl font-black tracking-tighter">QRON Postmaster Features</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                <Barcode className="w-5 h-5" style={{ color: BLUE }} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-3">Unique QRON Stamps</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Every piece of mail gets a unique QRON stamp with built-in tracking codes and anti-counterfeit features</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                <Lock className="w-5 h-5" style={{ color: BLUE }} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-3">Blockchain Verification</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">AuthiChain NFT certificates prove mail authenticity and prevent fraud</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                <TrendingUp className="w-5 h-5" style={{ color: BLUE }} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-3">Real-Time Tracking</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Track high-value mail from sender to recipient with real-time location updates</p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: BLUE }}>Use Cases</span>
            <h2 className="text-4xl font-black tracking-tighter">Who Benefits from QRON Stamps?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">Banks & Financial Institutions</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Secure checks, financial statements, and sensitive correspondence with QRON stamps that prove authenticity and prevent fraud.
              </p>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>✓ Check fraud prevention</li>
                <li>✓ Statement verification</li>
                <li>✓ High-value document tracking</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">Government & Legal</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Ensure court documents, government notices, and legal filings are authentic and tracked through the postal system.
              </p>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>✓ Legal document authentication</li>
                <li>✓ Certified mail verification</li>
                <li>✓ Government notice tracking</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">Healthcare</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Protect patient records, prescriptions, and medical documents with secure, trackable QRON-stamped mail.
              </p>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>✓ Patient record security</li>
                <li>✓ Prescription verification</li>
                <li>✓ HIPAA compliance tracking</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">E-Commerce & Shipping</h3>
              <p className="text-sm text-zinc-400 mb-4">
                High-value shipments and guaranteed delivery items with QRON stamps provide customers full transparency.
              </p>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>✓ High-value package tracking</li>
                <li>✓ Delivery proof</li>
                <li>✓ Anti-theft protection</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mb-24">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest block mb-3" style={{ color: BLUE }}>Pricing</span>
            <h2 className="text-4xl font-black tracking-tighter">Simple, Scalable Pricing</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">Basic</h3>
              <div className="text-3xl font-black mb-1">$0.15<span className="text-lg text-zinc-500">/stamp</span></div>
              <p className="text-xs text-zinc-600 mb-6">Minimum 10,000 stamps</p>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li>✓ Unique QRON codes</li>
                <li>✓ Postal tracking</li>
                <li>✓ Basic analytics</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 md:scale-105">
              <div className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 w-fit mb-4">
                <span className="text-[10px] font-black text-blue-400 uppercase">Most Popular</span>
              </div>
              <h3 className="text-lg font-black mb-4">Business</h3>
              <div className="text-3xl font-black mb-1">$0.10<span className="text-lg text-zinc-500">/stamp</span></div>
              <p className="text-xs text-zinc-600 mb-6">Minimum 50,000 stamps</p>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li>✓ All Basic features</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Priority support</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
              <h3 className="text-lg font-black mb-4">Enterprise</h3>
              <div className="text-3xl font-black mb-1">Custom<span className="text-lg text-zinc-500"></span></div>
              <p className="text-xs text-zinc-600 mb-6">Volume discounts available</p>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li>✓ All features</li>
                <li>✓ White-label option</li>
                <li>✓ Dedicated support</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-24 rounded-3xl text-center py-20 px-8 relative overflow-hidden border" style={{ borderColor: `${BLUE}20`, background: 'linear-gradient(135deg, #040a18 0%, #0a0a0a 50%, #04081a 100%)' }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${BLUE}08 0%, transparent 60%)` }} />
          <div className="relative z-10">
            <h2 className="text-4xl font-black tracking-tighter mb-4">Ready to Secure Your Mail?</h2>
            <p className="text-zinc-400 mb-10 max-w-md mx-auto">Join the postal revolution with QRON stamps.</p>
            <Link href="#" className="px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white inline-flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e40af 100%)` }}>
              <Mail className="w-4 h-4" /> Contact Sales
            </Link>
          </div>
        </section>

        <footer className="text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">
            QRON Postmaster · Mail Verification · © 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
