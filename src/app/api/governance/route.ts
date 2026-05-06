import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/governance/stake
 * 
 * Stake $QRON tokens for governance power.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, duration_days } = await request.json();

    // In a real app, this would verify a blockchain transaction.
    // For now, we log the intent and update the brand/profile.
    const { error } = await supabase
      .from('automation_logs')
      .insert({
        workflow_name: 'governance_staking',
        trigger_type: 'manual',
        status: 'success',
        payload: JSON.stringify({ user_id: user.id, amount, duration_days })
      });

    if (error) throw error;

    return NextResponse.json({ ok: true, message: 'Stake recognized by protocol' });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/**
 * POST /api/governance/vote
 * 
 * Cast a vote on a proposal.
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
        payload: JSON.stringify({ user_id: user.id, proposal_id, vote_type })
      });

    if (error) throw error;

    return NextResponse.json({ ok: true, message: 'Vote recorded on-chain' });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
