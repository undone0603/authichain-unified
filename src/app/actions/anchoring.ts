'use server';

import { anchorEdgeHash } from '@/lib/blockchain';
import { createClient } from '@/utils/supabase/server';
import { logAutomation, formatErr } from '@/lib/automation';
import { revalidatePath } from 'next/cache';

/**
 * Server Action: Anchors a QRON Edge hash to Polygon.
 * Part of Phase 2: Blockchain Transition.
 */
export async function anchorQRONAction(qronId: string, edgeHash: string) {
  const workflowName = 'qron_anchoring';
  try {
    const supabase = await createClient();
    
    // 1. Auth check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Unauthorized');

    console.log(`[Action] Initiating anchor for QRON ${qronId}`);

    // 2. Perform Anchoring
    const result = await anchorEdgeHash(edgeHash, `qron:${qronId}`);

    // 3. Update Database with transaction reference in the metadata column
    const { error: updateError } = await supabase
      .from('qrons')
      .update({
        metadata: {
          blockchain: 'polygon',
          tx_hash: result.txHash,
          anchor_id: result.anchorId,
          anchored_at: new Date().toISOString()
        }
      })
      .eq('id', qronId);

    if (updateError) throw updateError;

    await logAutomation(workflowName, 'manual', 'success', { qronId, txHash: result.txHash });

    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/qron/${qronId}`);

    return {
      success: true,
      txHash: result.txHash,
      anchorId: result.anchorId
    };

  } catch (err: unknown) {
    console.error('[Action] QRON Anchoring failed:', err);
    await logAutomation(workflowName, 'manual', 'failure', { qronId }, formatErr(err));
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Blockchain anchoring failed'
    };
  }
}

/**
 * Server Action: Anchors Industrial Telemetry (Theater 1/3) to Polygon.
 * Part of Phase 2: Industrial Provenance.
 */
export async function anchorTelemetryAction(eventId: string, stateHash: string, theater: string) {
  const workflowName = 'telemetry_anchoring';
  try {
    const supabase = await createClient();
    
    // Auth check (requires admin or brand-owner usually, but keeping it simple for now)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Unauthorized');

    console.log(`[Action] Anchoring Telemetry Event ${eventId} (${theater})`);

    // 1. Perform Anchoring
    const result = await anchorEdgeHash(stateHash, `telemetry:${theater}:${eventId}`);

    // 2. Update telemetry_events table
    const { error: updateError } = await supabase
      .from('telemetry_events')
      .update({
        anchored_tx_hash: result.txHash
      })
      .eq('id', eventId);

    if (updateError) throw updateError;

    await logAutomation(workflowName, 'manual', 'success', { eventId, theater, txHash: result.txHash });

    revalidatePath('/admin/telemetry');
    revalidatePath(`/admin/telemetry/${theater}`);

    return {
      success: true,
      txHash: result.txHash,
      anchorId: result.anchorId
    };

  } catch (err: unknown) {
    console.error('[Action] Telemetry Anchoring failed:', err);
    await logAutomation(workflowName, 'manual', 'failure', { eventId, theater }, formatErr(err));
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Industrial anchoring failed'
    };
  }
}
