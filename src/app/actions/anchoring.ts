'use server';

import { ANCHORING_UNAVAILABLE } from '@/lib/anchoring-status';
import { anchorEdgeHash } from '@/lib/blockchain';
import { createClient } from '@/utils/supabase/server';
import { logAutomation, formatErr } from '@/lib/automation';
import { revalidatePath } from 'next/cache';

/**
 * Server Action: QRON on-chain anchoring.
 *
 * Contained (P1): refuses every write and never calls the chain. The previous
 * version anchored a placeholder hash (the QR content or keccak256 of the id),
 * not a signature. Turning on-chain writes back on is Zac's call.
 */
export async function anchorQRONAction(
  _qronId: string,
  _edgeHash: string
): Promise<{ success: false; error: string; txHash?: undefined }> {
  return { success: false, error: ANCHORING_UNAVAILABLE };
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
