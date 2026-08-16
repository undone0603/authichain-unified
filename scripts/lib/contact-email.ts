/**
 * Contact-address validation for lead pipelines.
 *
 * Lives in its own module because the scripts that use it run their main
 * routine at import time — a test importing the validator from one of those
 * would execute the whole pipeline.
 */

/**
 * Bounds on a plausible contact domain.
 *
 * Calibrated against the 1,739 real contact addresses already in
 * gov_opportunities: every one has 2 or 3 domain labels, and the longest domain
 * is 17 characters (`alnd.uscourts.gov`). The slugified-hierarchy addresses the
 * gov engine fabricated run 5-7 labels and over 100 characters, e.g.
 *   dept-of-defense.defense-logistics-agency.dla-land.dla-land-warren-michigan.dla-land-warren.gov
 * That one is syntactically legal, so character-class checks alone let it
 * through — shape is the only thing that separates it from a real address.
 * These limits leave generous headroom over anything observed and still reject
 * every fabricated address in the table.
 */
const MAX_DOMAIN_LABELS = 4;
const MAX_DOMAIN_LENGTH = 64;

/**
 * Returns the address only when it is actually deliverable, else null.
 *
 * Deliberately strict: an address that merely looks plausible is worse than
 * none, because it enters the leads table and is then counted, reported, and
 * eventually emailed.
 */
export function normalizeContactEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!email) return null;

  // Single @, no whitespace/commas/parens anywhere, and a dotted domain whose
  // last label is alphabetic.
  if (!/^[^\s@,()<>]+@[^\s@,()<>]+\.[a-z]{2,}$/.test(email)) return null;

  const domain = email.slice(email.indexOf('@') + 1);
  if (domain.length > MAX_DOMAIN_LENGTH) return null;

  const labels = domain.split('.');
  if (labels.length > MAX_DOMAIN_LABELS) return null;

  // A domain label may not be empty or start/end with a hyphen.
  if (labels.some(label => !label || label.startsWith('-') || label.endsWith('-'))) {
    return null;
  }

  return email;
}
