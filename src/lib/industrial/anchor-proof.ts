import { ANCHORING_UNAVAILABLE } from "@/lib/anchoring-status";

/**
 * A HubSpot "anchor_proof" label is not a chain write.
 * This does not call the chain and does not build an explorer link.
 */
export function anchorProofDeliverable(): {
  anchored: false;
  artifactUrl: null;
  error: typeof ANCHORING_UNAVAILABLE;
} {
  return { anchored: false, artifactUrl: null, error: ANCHORING_UNAVAILABLE };
}
