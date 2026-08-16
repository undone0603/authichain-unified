/**
 * Automated-submission detection for the demo booking form.
 *
 * Every `book_page` lead recorded before this check was a bot: gmail dot-trick
 * addresses (`t.u.dux.abic.o.y33@gmail.com`) paired with random consonant-soup
 * company names. They all entered as `demo_requested` — the same status a
 * genuine demo request gets — so the lead table could not distinguish real
 * interest from noise, and neither could any metric built on top of it.
 *
 * Both signals here are structural rather than content-based. Content
 * heuristics (keyword lists, domain reputation) misfire on real prospects;
 * these two do not, because no genuine submission fills a field it cannot see,
 * and none arrives faster than a person can type.
 */

/** Minimum plausible time for a person to fill in four fields, in ms. */
export const MIN_FILL_MS = 3000;

export type BotReason = 'honeypot_filled' | 'submitted_too_fast';

export function detectBot(body: Record<string, unknown>): BotReason | null {
  if (typeof body.company_website === 'string' && body.company_website.trim() !== '') {
    return 'honeypot_filled';
  }

  // Absent or malformed timing is not evidence of a bot — older cached copies
  // of the page won't send it, and rejecting those would drop real prospects.
  // The honeypot still covers those submissions.
  const elapsed = body.elapsed_ms;
  if (typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed < MIN_FILL_MS) {
    return 'submitted_too_fast';
  }

  return null;
}
