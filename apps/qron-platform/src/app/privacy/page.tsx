import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | QRON by AuthiChain',
  description:
    'Privacy Policy for QRON (qron.space). Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight uppercase">
          Privacy <span className="gold-text">Policy</span>
        </h1>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mb-2">
          Effective Date: April 12, 2026
        </p>
        <p className="text-zinc-600 text-xs font-medium uppercase tracking-tighter">
          QRON is operated by AuthiChain, Michigan, USA
        </p>
      </section>

      <article className="max-w-3xl mx-auto px-6 pb-24 prose prose-invert prose-zinc prose-sm md:prose-base">
        <div className="protocol-card p-10 space-y-10 border-zinc-900">
          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              1. Introduction
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              AuthiChain (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates QRON at qron.space (the &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              2. Information We Collect
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gold uppercase tracking-widest mb-2">2.1 Information You Provide</h3>
                <ul className="list-disc pl-6 text-zinc-400 space-y-2">
                  <li><strong className="text-zinc-200">Account data:</strong> Email address for registry access.</li>
                  <li><strong className="text-zinc-200">Payment data:</strong> Securely processed via Stripe.</li>
                  <li><strong className="text-zinc-200">Input data:</strong> Prompts and URLs used for generation.</li>
                  <li><strong className="text-zinc-200">On-chain data:</strong> Wallet addresses for NFT minting.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gold uppercase tracking-widest mb-2">2.2 Automatically Collected</h3>
                <ul className="list-disc pl-6 text-zinc-400 space-y-2">
                  <li><strong className="text-zinc-200">Usage telemetry:</strong> Interaction patterns and generation history.</li>
                  <li><strong className="text-zinc-200">Technical data:</strong> IP address, device type, and referral source.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              3. Data Security
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              We implement industry-standard safeguards, including end-to-end encryption (TLS/SSL), secure Supabase authentication, and PCI-DSS compliant payment processing through Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              4. Blockchain Immutability
            </h2>
            <p className="text-zinc-400 leading-relaxed border-l-2 border-gold/20 pl-4 py-2 italic font-medium">
              Note: Data written to the Polygon blockchain (NFT mints) is permanent and cannot be modified or deleted.
            </p>
          </section>

          <div className="pt-12 border-t border-zinc-900 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex gap-6">
              <Link href="/terms" className="text-xs font-black uppercase text-gold hover:opacity-80 transition-opacity">
                Terms of Service
              </Link>
              <Link href="/" className="text-xs font-black uppercase text-zinc-500 hover:text-white transition-colors">
                Back to Home
              </Link>
            </div>
            <p className="text-[10px] font-bold text-zinc-600 uppercase">
              &copy; 2026 AuthiChain Inc.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
