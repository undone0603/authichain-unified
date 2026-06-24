import { Landmark, FileSearch, Sparkles, FileText, Trophy, Bell } from 'lucide-react';
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
      stats={[
        { value: 'SAM.gov', label: 'Auto-ingest' },
        { value: 'AI', label: 'Bid scoring' },
        { value: 'Proof', label: 'On-chain wins' },
        { value: '24/7', label: 'Monitoring' },
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
          desc: 'Generate compliant first-draft responses mapped to the RFP requirements, cutting capture time from weeks to hours.',
        },
        {
          icon: <Trophy className="h-6 w-6" />,
          title: 'On-Chain Proof-of-Win',
          desc: 'Mint verifiable proof-of-win NFTs for past performance you can show primes and partners without disclosing sensitive data.',
        },
        {
          icon: <Bell className="h-6 w-6" />,
          title: 'Real-Time Alerts',
          desc: 'Get notified the moment a matching opportunity, amendment, or deadline change is posted — never miss a cutoff.',
        },
        {
          icon: <Landmark className="h-6 w-6" />,
          title: 'Compliance Built In',
          desc: 'Every action is recorded to an immutable ledger, giving you an audit trail for contracting-officer scrutiny.',
        },
      ]}
      closingLine="Government Opportunities, Proven On-Chain."
    />
  );
}
