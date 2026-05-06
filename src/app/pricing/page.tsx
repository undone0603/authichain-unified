import type { Metadata } from 'next';
import { PLANS } from '@/lib/plans';
import { CheckoutModal } from './pricing-client';
import { 
  Check, 
  Coins
} from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing | QRON Protocol',
  description: 'Simple, transparent pricing for AI QR art and industrial product passports.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Header */}
      <section className="pt-32 pb-20 px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">
          PROTOCOL <span className="gold-text">ECONOMY</span>
        </h1>
        <p className="max-w-2xl mx-auto text-zinc-500 text-lg font-medium uppercase tracking-widest leading-relaxed">
          Start free. Scale with industrial power. <br />
          Every QRON is cryptographically signed.
        </p>
      </section>

      {/* Pricing Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              className={`protocol-card p-8 flex flex-col relative transition-all duration-500 group hover:translate-y-[-8px] ${
                plan.highlighted ? 'border-gold/40 bg-gold/5 shadow-[0_0_50px_rgba(201,162,39,0.1)]' : 'border-zinc-900 bg-zinc-950/50'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gold text-black px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white">${plan.price}</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{plan.price_suffix || ' one-time'}</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="flex-1 space-y-4 mb-10">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex gap-3">
                    <Check className={`w-4 h-4 shrink-0 ${plan.highlighted ? 'text-gold' : 'text-zinc-700'}`} />
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">{feature}</span>
                  </div>
                ))}
              </div>

              {plan.tier === 'free' ? (
                <Link 
                  href="/login" 
                  className="w-full py-4 rounded-xl border border-zinc-800 font-black uppercase tracking-widest text-xs text-center hover:bg-zinc-900 transition-colors"
                >
                  Start Free
                </Link>
              ) : (
                <CheckoutModal 
                  planId={plan.id} 
                  label={plan.name} 
                  price={`$${plan.price}`}
                  paymentLink={plan.stripe_payment_link}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bitcoin Ordinals Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-900">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F7931A]/10 border border-[#F7931A]/20 text-[#F7931A] text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <Coins className="w-4 h-4" />
            New: Bitcoin L1 Inscriptions
          </div>
          <h2 className="text-4xl font-black mb-6 uppercase tracking-tighter">
            Immutable <span className="text-[#F7931A]">Ordinals</span>
          </h2>
          <p className="max-w-xl mx-auto text-zinc-500 text-sm font-medium uppercase tracking-widest leading-relaxed">
            Store your AI QR art permanently on the world&apos;s most trusted blockchain. 
            Dual-chain proof for maximum verification.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
            {[
                { 
                    id: 'ordinal_single', 
                    name: 'Ordinal Single', 
                    price: '49', 
                    features: ['1 AI QR Art Inscription', 'Bitcoin L1 Permanence', 'Magic Eden Ready', 'Transferable Digital Artifact'],
                    link: 'https://buy.stripe.com/14A00jbjz9Ns5ia5fe1Nu1d'
                },
                { 
                    id: 'ordinal_auth', 
                    name: 'BTC Dual-Auth', 
                    price: '299', 
                    features: ['Product Cert on BTC', 'Dual-Chain Proof', 'Authichain Verification', 'Brand Inscription'],
                    link: 'https://buy.stripe.com/dRm3cv0EV6BgeSKdLK1Nu1e',
                    highlight: true
                },
                { 
                    id: 'ordinal_collection', 
                    name: 'Batch Collection', 
                    price: '799', 
                    features: ['25 L1 Inscriptions', 'Collection Listing', 'Enterprise Scale', 'Co-Marketing Rights'],
                    link: 'https://buy.stripe.com/eVq9AT5Zff7MbGy8rq1Nu1f'
                }
            ].map(o => (
                <div key={o.id} className={`protocol-card p-8 border-[#F7931A]/20 bg-[#F7931A]/5 ${o.highlight ? 'ring-2 ring-[#F7931A]/40' : ''}`}>
                    <h3 className="text-[10px] font-black uppercase text-[#F7931A] mb-2">{o.name}</h3>
                    <div className="flex items-baseline gap-1 mb-8">
                        <span className="text-3xl font-black text-white">${o.price}</span>
                    </div>
                    <ul className="space-y-4 mb-10">
                        {o.features.map(f => (
                            <li key={f} className="flex gap-3">
                                <span className="text-[#F7931A] text-xs">â‚¿</span>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">{f}</span>
                            </li>
                        ))}
                    </ul>
                    <a 
                        href={o.link} 
                        target="_blank" 
                        rel="noopener"
                        className="block w-full py-4 rounded-xl bg-[#F7931A] text-black font-black uppercase tracking-widest text-xs text-center"
                    >
                        Inscribe Now
                    </a>
                </div>
            ))}
        </div>
      </section>

      {/* Enterprise Support */}
      <section className="bg-zinc-950 border-y border-zinc-900 py-20 px-6 text-center">
        <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter">
          Need Custom <span className="gold-text">Enterprise</span> Scale?
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/digital-product-passport" className="btn-outline-gold px-10 py-4 font-black uppercase tracking-widest text-xs border-zinc-800">
            Explore Industrial DPP
          </Link>
          <a href="mailto:ops@qron.space" className="btn-gold px-10 py-4 font-black uppercase tracking-widest text-xs shadow-gold">
            Contact Sales
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6">
        <p className="text-center text-[10px] font-bold text-zinc-800 uppercase tracking-widest">
            Payments secured by Stripe Â· AI Engine by Fal.ai Â· Settlement on Polygon & Bitcoin
        </p>
      </footer>
    </div>
  );
}
