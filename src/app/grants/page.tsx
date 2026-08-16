import type { Metadata } from 'next';
import { FileSearch, Sparkles, FileText, Trophy, Bell, Landmark } from 'lucide-react';
import { BrandLanding } from '../_home/BrandLanding';

export const metadata: Metadata = {
  title: 'Federal Opportunities | GovChain',
  description: 'Automated SAM.gov ingestion, AI bid scoring, proposal drafting, and on-chain proof-of-win NFTs for federal contractors.',
};

export default function GrantsPage() {
  return (
    <BrandLanding
      brandId="govchain"
      themeClass="theme-patriotic"
      eyebrow="Federal Opportunities"
      headline="Win More Government Contracts."
      subhead="Automated SAM.gov ingestion, AI win-probability scoring, draft proposals, and verifiable on-chain proof-of-win — your full capture pipeline."
      primaryCta={{ label: 'See Plans', href: '/pricing' }}
      secondaryCta={{ label: 'Open Dashboard', href: '/dashboard' }}
      stats={[
        { value: 'SAM.gov', label: 'Auto-ingest' },
        { value: 'AI', label: 'Scored bids' },
        { value: 'Draft', label: 'Proposals' },
        { value: 'On-chain', label: 'Proof-of-win' },
      ]}
      features={[
        {
          icon: <FileSearch className="h-6 w-6" />,
          title: 'Automated Ingestion',
          desc: 'Continuously pull federal opportunities and filter to your NAICS codes, set-asides, and capabilities — no manual searching.',
        },
        {
          icon: <Sparkles className="h-6 w-6" />,
          title: 'AI Win Scoring',
          desc: 'Each solicitation is scored for fit and win-probability so your team focuses only on bids worth pursuing.',
        },
        {
          icon: <FileText className="h-6 w-6" />,
          title: 'Proposal Drafting',
          desc: 'Generate compliant first drafts mapped to RFP requirements, cutting capture time from weeks to hours.',
        },
        {
          icon: <Trophy className="h-6 w-6" />,
          title: 'Proof-of-Win NFTs',
          desc: 'Mint verifiable past-performance proof you can share with primes and partners without exposing sensitive data.',
        },
        {
          icon: <Bell className="h-6 w-6" />,
          title: 'Real-Time Alerts',
          desc: 'Get notified the instant a matching opportunity, amendment, or deadline change posts — never miss a cutoff.',
        },
        {
          icon: <Landmark className="h-6 w-6" />,
          title: 'Audit-Ready Ledger',
          desc: 'Every action is recorded to an immutable ledger, giving you a defensible trail for contracting-officer scrutiny.',
        },
      ]}
      closingLine="Government Opportunities, Proven On-Chain."
    />
  );
}
