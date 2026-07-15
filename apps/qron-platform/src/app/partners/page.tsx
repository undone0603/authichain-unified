import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Partners | QRON Protocol',
  description: 'Partner with the AuthiChain ecosystem. Reseller, integration, and enterprise partnership opportunities for technology and distribution partners.',
};

const partnerTiers = [
  {
    tier: 'Integration Partner',
    description: 'Build on top of the QRON and AuthiChain APIs to embed verified QR authentication into your products.',
    benefits: ['API access at partner rates', 'Co-marketing support', 'Technical integration docs', 'Listed in partner directory'],
    cta: 'Apply Now',
    href: '/partners/brief',
  },
  {
    tier: 'Reseller Partner',
    description: 'White-label the QRON platform and resell to your customers with your branding and pricing.',
    benefits: ['White-label dashboard access', '30% revenue share', 'Dedicated account manager', 'Custom onboarding support'],
    cta: 'Get Partner Brief',
    href: '/partners/brief',
  },
  {
    tier: 'Enterprise Alliance',
    description: 'Strategic partnerships for enterprises, agencies, and government contractors seeking blockchain authentication infrastructure.',
    benefits: ['Custom SLA & support', 'Joint go-to-market campaigns', 'Priority feature roadmap input', 'Dedicated infrastructure'],
    cta: 'Contact Us',
    href: '/contact',
  },
];

const ecosystemPartners = [
  { name: 'AuthiChain', description: 'Core blockchain verification protocol', href: 'https://www.authichain.com', tag: 'Protocol' },
  { name: 'StrainChain', description: 'Cannabis compliance and NFT authentication', href: 'https://strainchain.io', tag: 'Compliance' },
  { name: 'GovChain', description: 'Government contracting and grant intelligence', href: 'https://govchain.us', tag: 'Government' },
];

export default function PartnersPage() {
  return (
    <main className="min-h-screen bg-black text-white px-4 py-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-yellow-400 font-mono text-sm tracking-widest mb-4">ECOSYSTEM PARTNERSHIPS</p>
          <h1 className="text-5xl font-bold mb-6">Build With <span className="text-yellow-400">AuthiChain</span></h1>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto">
            Join the authentication-first ecosystem powering verified supply chains, cannabis compliance, and government contracting.
          </p>
        </div>

        {/* Partner Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {partnerTiers.map((tier) => (
            <div key={tier.tier} className="border border-gray-800 rounded-lg p-8 hover:border-yellow-400/50 transition-colors">
              <h2 className="text-xl font-bold mb-3">{tier.tier}</h2>
              <p className="text-gray-400 mb-6 text-sm">{tier.description}</p>
              <ul className="space-y-2 mb-8">
                {tier.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-yellow-400 mt-0.5">▸</span>
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className="block text-center border border-yellow-400 text-yellow-400 py-3 px-6 font-mono text-sm hover:bg-yellow-400 hover:text-black transition-colors"
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Ecosystem Section */}
        <div className="border-t border-gray-800 pt-16">
          <h2 className="text-2xl font-bold mb-8 text-center">The AuthiChain Ecosystem</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ecosystemPartners.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gray-800 rounded-lg p-6 hover:border-yellow-400/50 transition-colors group"
              >
                <span className="text-xs font-mono text-yellow-400 mb-2 block">{p.tag}</span>
                <h3 className="text-lg font-bold mb-2 group-hover:text-yellow-400 transition-colors">{p.name}</h3>
                <p className="text-gray-400 text-sm">{p.description}</p>
              </a>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-400 mb-6">Ready to partner with the verification-first web?</p>
          <Link
            href="/contact"
            className="inline-block bg-yellow-400 text-black font-bold py-4 px-12 font-mono text-sm hover:bg-yellow-300 transition-colors"
          >
            START PARTNERSHIP CONVERSATION
          </Link>
        </div>
      </div>
    </main>
  );
}
