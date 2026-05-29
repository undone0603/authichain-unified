import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Shield,
  ChevronLeft,
  Lock,
  Zap,
  Server,
  PlayCircle
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Technology | AuthiChain Protocol',
  description: 'Deep dive into the Ed25519 signatures, Polygon anchoring, and the API powering AuthiChain.',
};

export default function AuthichainTechnology() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Shield className="w-3 h-3" />
              Core Infrastructure
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          THE PROTOCOL <br /> <span className="gold-text">ARCHITECTURE.</span>
        </h1>

        <div className="grid md:grid-cols-3 gap-12 mt-20">
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Lock className="w-8 h-8 text-gold mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Ed25519 Cryptography</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                Every asset secured by AuthiChain is hashed and signed using the Ed25519 curve. This provides NIST-compliant, quantum-resistant security capable of executing thousands of signatures per second on mobile edge nodes.
              </p>
            </div>
            
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Server className="w-8 h-8 text-blue-400 mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Polygon Anchoring</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                State hashes are periodically anchored to the Polygon Proof-of-Stake (PoS) network via an automated smart contract roll-up. This ensures immutable, publicly verifiable provenance without passing unpredictable gas fees to end users.
              </p>
            </div>

            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Zap className="w-8 h-8 text-green-400 mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">API & Edge Fleet</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter">
                Our Cloudflare Workers edge fleet handles signature validation globally in under 50ms. Enterprise systems can integrate our high-throughput REST API to automate verification natively within their own manufacturing lines.
              </p>
            </div>
        </div>

        <div className="mt-20 protocol-card p-8 border-gold/30" style={{ background: 'linear-gradient(135deg, rgba(201,162,39,0.08) 0%, rgba(13,13,13,0.6) 60%)' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gold mb-2">Interactive Walkthrough</p>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-2">See the Protocol in motion.</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium max-w-xl">
                A self-contained scan-to-verify demo — sign, anchor, and authenticate without leaving the page.
              </p>
            </div>
            <a
              href="/media/authichain-demo.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 hover:border-gold transition-all text-xs font-black uppercase tracking-widest whitespace-nowrap"
            >
              <PlayCircle className="w-5 h-5" />
              Launch Demo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}