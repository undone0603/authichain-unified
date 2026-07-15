import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Target, Zap, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
    title: 'QRON Affiliate Program — Earn 20% Per Sale',
  description:
    'Earn 20% recurring commission on every QRON sale you refer. Custom link, real-time dashboard, monthly payouts.',
};

const TIERS = [
  {
    name: 'Starter',
        sales: '1–10/mo',
    commission: '20%',
    payout: 'Monthly',
    perks: 'Custom link, basic dashboard',
  },
  {
    name: 'Partner',
        sales: '11–50/mo',
    commission: '25%',
    payout: 'Monthly',
    perks: 'Priority support, co-marketing',
  },
  {
    name: 'Agency',
    sales: '51+/mo',
    commission: '30%',
    payout: 'Bi-weekly',
    perks: 'White-label option, dedicated rep',
  },
];

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold uppercase tracking-widest mb-8">
          <Zap className="w-3 h-3" />
          Revenue Opportunity
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
          Earn <span className="gold-text">20% Recurring</span> on Every QRON
        </h1>
        <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Join the QRON Affiliate Program and turn your audience or clients into
          a recurring revenue stream. High-conversion AI art sells itself.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/affiliate/apply" className="btn-gold px-10 py-4 text-lg">
            Apply to Join â†’
          </Link>
          <Link
            href="/login"
            className="btn-outline-gold px-10 py-4 text-lg border-zinc-800 text-zinc-300"
          >
            Affiliate Login
          </Link>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-zinc-950 border-y border-zinc-900 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16 gold-text">
            Simple Three-Step Success
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Apply & Get Link',
                desc: 'Instant approval for designers, agencies, and content creators. Get your unique tracking link.',
                icon: <Target className="w-6 h-6 text-gold" />,
              },
              {
                step: '02',
                title: 'Share the Art',
                desc: 'Post QRON examples on social media or include AI QR art in your client branding proposals.',
                icon: <Zap className="w-6 h-6 text-gold" />,
              },
              {
                step: '03',
                title: 'Earn Recurring',
                desc: 'Get 20-30% of every initial sale AND every subscription renewal, paid out automatically.',
                icon: <Shield className="w-6 h-6 text-gold" />,
              },
            ].map((s) => (
              <div key={s.step} className="protocol-card p-8 group">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 rounded-xl bg-gold/5 border border-gold/10 group-hover:border-gold/30 transition-colors">
                    {s.icon}
                  </div>
                  <span className="text-4xl font-black text-zinc-900 leading-none">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-black mb-4">Affiliate Tiers</h2>
          <p className="text-zinc-500 uppercase tracking-widest text-xs">
            Scale your earnings as you grow
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className="protocol-card p-8 border-zinc-800 flex flex-col"
            >
              <h3 className="text-lg font-bold text-zinc-400 mb-2 uppercase tracking-tight">
                {t.name}
              </h3>
              <div className="text-5xl font-black gold-text mb-6">
                {t.commission}
              </div>
              <div className="space-y-4 mb-8 flex-grow">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-gold" />
                  <span className="text-zinc-300">{t.sales} sales/mo</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-gold" />
                  <span className="text-zinc-300">{t.payout} Payouts</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-gold mt-1" />
                  <span className="text-zinc-500">{t.perks}</span>
                </div>
              </div>
              <Link
                href="/affiliate/apply"
                className="btn-outline-gold py-3 text-center rounded-xl font-bold"
              >
                Join {t.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 text-center bg-gold/5 border-t border-gold/10">
        <h2 className="text-4xl font-black mb-6">
          Start Your Revenue Engine Today
        </h2>
        <p className="text-zinc-400 mb-10 max-w-md mx-auto">
          QRON is the gold standard for AI QR codes. Help us secure the visual
          internet and get paid for it.
        </p>
        <Link
          href="/affiliate/apply"
          className="btn-gold px-12 py-4 text-xl font-black shadow-gold"
        >
          Become a QRON Partner
        </Link>
      </section>
    </div>
  );
}
