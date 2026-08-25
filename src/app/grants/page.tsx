import type { Metadata } from 'next';
import { FileSearch, Sparkles, FileText, Trophy, Bell, Landmark } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { BrandLanding } from '../_home/BrandLanding';
import { OpportunityRadar } from './OpportunityRadar';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Federal Opportunities | GovChain',
  description: 'Automated SAM.gov ingestion, AI bid scoring, proposal drafting, and on-chain proof-of-win NFTs for federal contractors.',
};

async function getLiveStats() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const sb = createClient(url, key);
    const [scored, highFit, proposals] = await Promise.all([
      sb.from('gov_opportunities').select('*', { count: 'exact', head: true }),
      sb.from('gov_opportunities').select('*', { count: 'exact', head: true }).gte('fit_score', 70),
      sb.from('gov_proposals').select('*', { count: 'exact', head: true }),
    ]);
    return {
      scored: scored.count ?? 0,
      highFit: highFit.count ?? 0,
      proposals: proposals.count ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function GrantsPage() {
  const live = await getLiveStats();

  return (
    <BrandLanding
      brandId="govchain"
      themeClass="theme-patriotic"
      eyebrow="Federal Opportunities"
      headline="Win More Government Contracts."
      subhead="Automated SAM.gov ingestion, AI win-probability scoring, draft proposals, and verifiable on-chain proof-of-win — your full capture pipeline."
      primaryCta={{ label: 'See Plans', href: '/pricing' }}
      secondaryCta={{ label: 'Open Dashboard', href: '/dashboard' }}
      stats={
        live
          ? [
              { value: String(live.scored), label: 'Opportunities Scored' },
              { value: String(live.highFit), label: 'High-Fit (70+)' },
              { value: String(live.proposals), label: 'Proposals Drafted' },
              { value: 'On-chain', label: 'Proof-of-win' },
            ]
          : [
              { value: 'SAM.gov', label: 'Auto-ingest' },
              { value: 'AI', label: 'Scored bids' },
              { value: 'Draft', label: 'Proposals' },
              { value: 'On-chain', label: 'Proof-of-win' },
            ]
      }
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
    >
      <OpportunityRadar />
    </BrandLanding>
  );
}
