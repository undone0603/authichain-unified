/** METRC sync is off. This is not a package match and not a passport scan. */
export const METRC_UNAVAILABLE = "metrc_unavailable";

export function metrcUnavailable() {
  return {
    available: false as const,
    reason: METRC_UNAVAILABLE,
  };
}
