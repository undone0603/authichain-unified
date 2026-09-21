import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  QRON_ERC20,
  QRON_TOTAL_SUPPLY,
  WEB3_IDENTITY_DOC,
} from '@/lib/authentic-economy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance
 * Theater stats for the govchain.us staking UI — not live tokenomics.
 * $QRON total supply is 1,000,000,000 (18 decimals) at 0xAebf….
 * See docs/strategy/WEB3_IDENTITY.md. Do not thaw gov-mint to make these real.
 * The `governance` figures below are display theater, not circulating supply.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    theater: true,
    liveTokenomics: false,
    identity: WEB3_IDENTITY_DOC,
    actual: {
      token: '$QRON',
      contract: QRON_ERC20,
      totalSupply: String(QRON_TOTAL_SUPPLY),
      isPaymentRail: false,
    },
    governance: {
      token: '$QRON',
      totalSupply: '100,000,000',
      circulatingSupply: '42,000,000',
      stakedAmount: '18,500,000',
      stakedPercent: '44.0%',
      votingPower: 'pro-rata staked $QRON',
      quorum: '5%',
      proposalThreshold: '10,000 $QRON staked',
      theater: true,
    },
    proposals: [
      {
        id: 'PROP-001',
        title: 'Increase Free Tier QR Limit to 25/month',
        description: 'Proposal to raise the free tier monthly QR generation limit from 10 to 25 to drive adoption.',
        status: 'active',
        votesFor: 2450000,
        votesAgainst: 312000,
        quorumReached: true,
        endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 'PROP-002',
        title: 'Add Polygon zkEVM for NFT Minting',
        description: 'Integrate Polygon zkEVM as an additional chain for QR NFT minting with lower gas fees.',
        status: 'passed',
        votesFor: 8100000,
        votesAgainst: 440000,
        quorumReached: true,
        endsAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
      },
      {
        id: 'PROP-003',
        title: 'Partnership Revenue Share with AuthiChain',
        description: 'Allocate 15% of cross-platform revenue to $QRON stakers when AuthiChain integration launches.',
        status: 'pending',
        votesFor: 0,
        votesAgainst: 0,
        quorumReached: false,
        endsAt: new Date(Date.now() + 86400000 * 14).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ],
    timestamp: new Date().toISOString()
  });
}

/**
 * POST /api/governance/stake
 *
 * Theater stake intent. Not on-chain. Do not thaw gov-mint.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, duration_days } = await request.json();

    const { error } = await supabase
      .from('automation_logs')
      .insert({
        workflow_name: 'governance_staking',
        trigger_type: 'manual',
        status: 'success',
        payload: JSON.stringify({ user_id: user.id, amount, duration_days, theater: true })
      });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      theater: true,
      message: 'Theater stake logged — not on-chain, not live tokenomics',
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/**
 * PUT /api/governance
 *
 * Theater vote. Not on-chain.
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { proposal_id, vote_type } = await request.json();

    const { error } = await supabase
      .from('automation_logs')
      .insert({
        workflow_name: 'governance_voting',
        trigger_type: 'manual',
        status: 'success',
        payload: JSON.stringify({ user_id: user.id, proposal_id, vote_type, theater: true })
      });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      theater: true,
      message: 'Theater vote logged — not on-chain, not live tokenomics',
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
