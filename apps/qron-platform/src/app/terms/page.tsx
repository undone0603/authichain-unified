import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | QRON by AuthiChain',
  description:
    'Terms of Service for QRON (qron.space), the AI-powered QR code generation platform operated by AuthiChain.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight uppercase">
          Terms of <span className="gold-text">Service</span>
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
              1. Acceptance of Terms
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              By accessing or using QRON at qron.space (the &quot;Service&quot;),
              you agree to be bound by these Terms of Service (&quot;Terms&quot;).
              If you do not agree to these Terms, you may not use the Service.
              These Terms constitute a legally binding agreement between you and
              AuthiChain (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              2. Description of Service
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              QRON is an AI-powered QR code generation platform. Features include:
            </p>
            <ul className="list-disc pl-6 text-zinc-400 space-y-2">
              <li>AI-generated QR code art from text prompts and URLs</li>
              <li>Optional blockchain minting of QR code art as NFTs</li>
              <li>User dashboard and generation history</li>
              <li>Living Portals with dynamic redirect capabilities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              3. User Accounts
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials. 
              You must be at least 13 years of age to create an account. 
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              4. Payment Terms
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              Payments are processed securely through Stripe.
            </p>
            <ul className="list-disc pl-6 text-zinc-400 space-y-2">
              <li>Subscription plans renew automatically unless cancelled.</li>
              <li>One-time purchases are non-refundable once assets are delivered.</li>
              <li>Credits purchased in packs never expire.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              5. Intellectual Property
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Your content:</strong> You retain ownership of the QR code art generated using your prompts.
            </p>
            <p className="text-zinc-400 leading-relaxed mt-4">
              <strong className="text-zinc-200">Our platform:</strong> All rights in the QRON platform, branding, and algorithms remain the exclusive property of AuthiChain.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
              6. Limitation of Liability
            </h2>
            <p className="text-zinc-400 leading-relaxed uppercase text-xs font-bold border-l-2 border-gold/20 pl-4 py-2 italic">
              The service is provided &quot;as is&quot;. AuthiChain shall not be liable for any indirect, incidental, or special damages arising from your use of the service.
            </p>
          </section>

          <div className="pt-12 border-t border-zinc-900 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex gap-6">
              <Link href="/privacy" className="text-xs font-black uppercase text-gold hover:opacity-80 transition-opacity">
                Privacy Policy
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
