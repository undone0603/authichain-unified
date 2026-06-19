'use client';

import { CheckCircle2, Zap, Shield, Flame } from 'lucide-react';

interface PricingTier {
  name: string;
  description: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  ctaUrl: string;
  highlight?: boolean;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  tagColor: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'QRON.space',
    description: 'AI Creative Utility',
    price: 'Free',
    period: 'forever',
    features: [
      'Unlimited QR code generation',
      'Basic AI design customization',
      'Cloud storage (1GB)',
      'Community gallery access',
      'Email support',
    ],
    cta: 'Start Creating',
    ctaUrl: '/studio',
    icon: <Zap className="w-6 h-6" />,
    color: 'text-green-400',
    borderColor: 'border-green-500/30',
    tagColor: 'bg-green-500/10',
  },
  {
    name: 'AuthiChain',
    description: 'Enterprise Protection',
    price: '$199',
    period: '/project',
    features: [
      'Tamper-evident QR codes',
      'Certificate generation',
      'API access',
      'Advanced analytics',
      'Priority support',
      '99.9% SLA',
    ],
    cta: 'Start Pilot',
    ctaUrl: '/founders',
    highlight: true,
    icon: <Shield className="w-6 h-6" />,
    color: 'text-gold',
    borderColor: 'border-gold/50',
    tagColor: 'bg-gold/10',
  },
  {
    name: 'StrainChain.io',
    description: 'Industrial Compliance',
    price: '$499',
    period: '/month',
    features: [
      'Geo-fencing & provenance',
      'Batch certification',
      'Real-time tracking',
      'Compliance reports',
      'Dedicated account manager',
      'Custom integrations',
    ],
    cta: 'Request Demo',
    ctaUrl: 'https://strainchain.io',
    icon: <Flame className="w-6 h-6" />,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    tagColor: 'bg-blue-500/10',
  },
  {
    name: 'GovChain.us',
    description: 'DAO Governance',
    price: 'Custom',
    period: 'enterprise',
    features: [
      'Multi-tenant governance',
      'Yield farming (12.4%)',
      'Treasury management',
      'Voter analytics',
      'Enterprise SLA',
      'White-label available',
    ],
    cta: 'Contact Sales',
    ctaUrl: 'https://govchain.us',
    icon: <CheckCircle2 className="w-6 h-6" />,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    tagColor: 'bg-purple-500/10',
  },
];

export default function MonetizationArchitecture() {
  return (
    <div className="w-full py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-gold font-black text-[10px] uppercase tracking-[0.3em] mb-4">
            Four Vertical Ecosystem
          </p>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
            Monetization <span className="gold-text">Architecture</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Transparent, scalable pricing across all AuthiChain verticals. Choose the tier that fits your business.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl backdrop-blur-sm transition-all group ${
                tier.highlight
                  ? `border-2 ${tier.borderColor} bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 shadow-2xl scale-105`
                  : `border border-zinc-800 bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 hover:border-zinc-700`
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-gold text-black text-[10px] font-black uppercase tracking-widest">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Icon & Name */}
              <div className="p-6 pb-4">
                <div className={`p-3 rounded-xl ${tier.tagColor} border ${tier.borderColor} w-fit mb-4`}>
                  <div className={tier.color}>{tier.icon}</div>
                </div>
                <h3 className={`text-xl font-black uppercase tracking-tight ${tier.color} mb-1`}>
                  {tier.name}
                </h3>
                <p className="text-xs text-zinc-400 font-medium">{tier.description}</p>
              </div>

              {/* Pricing */}
              <div className="px-6 py-4 border-y border-zinc-800">
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black ${tier.color}`}>{tier.price}</span>
                  {tier.period && <span className="text-[10px] font-bold text-zinc-500 uppercase">{tier.period}</span>}
                </div>
              </div>

              {/* Features */}
              <div className="p-6 space-y-3 flex-1">
                {tier.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className={`w-4 h-4 ${tier.color} flex-shrink-0 mt-0.5`} />
                    <span className="text-xs text-zinc-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="p-6 pt-4">
                <a
                  href={tier.ctaUrl}
                  className={`block w-full py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-widest transition-all text-center ${
                    tier.highlight
                      ? `bg-gold text-black hover:bg-gold/80`
                      : `bg-zinc-800/50 border border-zinc-700 text-white hover:bg-zinc-800 hover:border-zinc-600`
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise Footer */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-zinc-900/50 to-zinc-950/50 border border-zinc-800 text-center">
          <p className="text-zinc-300 text-sm mb-4">
            Custom enterprise solutions and bulk licensing available.
          </p>
          <a
            href="mailto:sales@authichain.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gold font-bold text-sm uppercase tracking-widest transition-colors"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </div>
  );
}
