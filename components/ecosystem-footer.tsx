// components/ecosystem-footer.tsx
import Link from 'next/link';

const ECOSYSTEM = [
  { name: 'AuthiChain',  url: 'https://authichain.com',                                   color: 'text-accent'   },
  { name: 'QRON',        url: process.env.NEXT_PUBLIC_QRON_URL ?? 'https://qron.io',       color: 'text-qron'     },
  { name: 'StrainChain', url: process.env.NEXT_PUBLIC_STRAINCHAIN_URL ?? 'https://strainchain.io', color: 'text-strain' },
  { name: 'GovChain',    url: process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us', color: 'text-govchain' },
];

const LINKS = {
  Platform: [
    { label: 'Verify Product',   href: '/verify' },
    { label: 'Mint Seal',        href: '/mint' },
    { label: 'Dashboard',        href: '/dashboard' },
    { label: 'API Docs',         href: '/docs' },
  ],
  Government: [
    { label: 'GovChain Portal',  href: process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us' },
    { label: 'SAM.gov Opps',     href: `${process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us'}/opportunities` },
    { label: 'Proposals',        href: `${process.env.NEXT_PUBLIC_GOVCHAIN_URL ?? 'https://govchain.us'}/proposals` },
    { label: 'SBIR/STTR',        href: '/sbir' },
  ],
  Company: [
    { label: 'About',            href: '/about' },
    { label: 'Blog',             href: '/blog' },
    { label: 'Privacy',          href: '/privacy' },
    { label: 'Terms',            href: '/terms' },
  ],
};

export function EcosystemFooter() {
  return (
    <footer className="border-t border-border bg-surface mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">

        {/* Top: logo + ecosystem badges */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <span className="text-accent font-mono text-sm font-bold">A</span>
              </div>
              <span className="font-semibold text-white text-lg">AuthiChain</span>
            </div>
            <p className="text-muted text-sm max-w-xs">
              Blockchain-powered authentication for products, cannabis, and government supply chains.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {ECOSYSTEM.map((item) => (
              <a
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm font-mono px-3 py-1.5 rounded-full border border-border hover:border-current transition-colors ${item.color}`}
              >
                {item.name}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted mb-4">{section}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted hover:text-white transition-colors"
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} AuthiChain, Inc. All rights reserved.
          </p>
          <p className="text-xs text-muted font-mono">
            Powered by <span className="text-accent">blockchain</span> · Built on{' '}
            <span className="text-secondary">Base</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
