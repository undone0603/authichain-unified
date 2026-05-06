'use server';

import { anchorEdgeHash } from '@/lib/blockchain';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Server Action: Anchors a QRON Edge hash to Polygon.
 * Part of Phase 2: Blockchain Transition.
 */
export async function anchorQRONAction(qronId: string, edgeHash: string) {
  try {
    const supabase = await createClient();
    
    // 1. Auth check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Unauthorized');

    console.log(`[Action] Initiating anchor for QRON ${qronId}`);

    // 2. Perform Anchoring
    const result = await anchorEdgeHash(edgeHash, `qron:${qronId}`);

    // 3. Update Database with transaction reference
    const { error: updateError } = await supabase
      .from('qrons')
      .update({
        // Assuming we store tx_hash and block number in the qrons table
        // or a related metadata table.
        // For now, we log it and update a hypothetical field.
        metadata: {
          blockchain: 'polygon',
          tx_hash: result.txHash,
          anchor_id: result.anchorId,
          anchored_at: new Date().toISOString()
        }
      })
      .eq('id', qronId);

    if (updateError) throw updateError;

    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/qron/${qronId}`);

    return {
      success: true,
      txHash: result.txHash,
      anchorId: result.anchorId
    };

  } catch (err: unknown) {
    console.error('[Action] Anchoring failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Blockchain anchoring failed'
    };
  }
}
