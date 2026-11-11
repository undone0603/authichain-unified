/**
 * StrainChain METRC sync is off.
 * This function does not call METRC and does not anchor.
 */
import { metrcUnavailable } from "../metrc-unavailable";

export async function runStrainChainSync() {
  const refused = metrcUnavailable();
  return {
    itemsProcessed: 0,
    details: {
      status: refused.reason,
      totalAnchored: 0,
    },
  };
}
