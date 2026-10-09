'use server';

import { ANCHORING_UNAVAILABLE } from '@/lib/anchoring-status';

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
