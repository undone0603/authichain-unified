import { FileSearch, Sparkles, FileText, Trophy } from 'lucide-react';
import { BrandLanding } from './BrandLanding';

/**
 * GovChain (govchain.us) — federal contracting opportunity intelligence.
 * Uses the patriotic (red/white/blue) theme.
 */
export function GovchainHome() {
  return (
    <BrandLanding
      brandId="govchain"
      themeClass="theme-patriotic"
      eyebrow="Government Opportunities"
      primaryCta={{ label: 'Request access', href: '/onboard' }}
      secondaryCta={{ label: 'Browse opportunities', href: '/opportunities' }}
      stats={[
        { value: '/onboard', label: 'Live intake' },
        { value: 'SAM.gov', label: 'Notice source' },
        { value: 'No mint CTA', label: 'No live gov-mint' },
      ]}
      features={[
        {
          icon: <FileSearch className="h-6 w-6" />,
          title: 'Automated SAM.gov Ingestion',
          desc: 'Continuously pull new federal opportunities and filter them to your NAICS codes, set-asides, and capabilities — no manual searching.',
        },
        {
          icon: <Sparkles className="h-6 w-6" />,
          title: 'AI Opportunity Scoring',
          desc: 'Every solicitation is scored for fit and win-probability so your team spends time on the bids you can actually win.',
        },
        {
          icon: <FileText className="h-6 w-6" />,
          title: 'Proposal Drafting',
          desc: 'Proposal first drafts: in development.',
        },
        {
          icon: <Trophy className="h-6 w-6" />,
          title: 'Public datalog',
          desc: 'Intake records stay on the /onboard path. This page does not promise a live government mint or cold outbound.',
        },
      ]}
      closingLine="Pursue Smarter. Prove Everything."
    />
  );
}
