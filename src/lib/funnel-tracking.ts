/**
 * Funnel Tracking Utility
 *
 * Helper functions for logging conversion funnel events.
 * Use throughout the application to track prospect journeys.
 */

export type FunnelStage =
  | 'proposal_sent'
  | 'email_opened'
  | 'link_clicked'
  | 'visit_landing_page'
  | 'start_checkout'
  | 'complete_checkout'
  | 'subscribe';

export type FunnelSource =
  | 'gov_engine'
  | 'linkedin_post'
  | 'reddit_post'
  | 'seo'
  | 'direct'
  | 'email'
  | 'affiliate';

interface TrackFunnelEventOptions {
  prospectId: string;
  stage: FunnelStage;
  source: FunnelSource;
  eventType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track a funnel event
 *
 * @example
 * trackFunnelEvent({
 *   prospectId: 'prospect_12345',
 *   stage: 'email_opened',
 *   source: 'gov_engine',
 *   eventType: 'opened_via_campaign_5',
 *   metadata: { campaignId: 'campaign_5' }
 * })
 */
export async function trackFunnelEvent(
  options: TrackFunnelEventOptions
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch('/api/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect_id: options.prospectId,
        stage: options.stage,
        source: options.source,
        event_type: options.eventType,
        metadata: options.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Failed to track funnel event',
      };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[funnel-tracking] Error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Extract prospect ID from URL search parameters
 * Format: ?prospect_id=X
 */
export function getProspectIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  return params.get('prospect_id');
}

/**
 * Extract source from URL search parameters
 * Format: ?utm_source=gov_engine&utm_medium=email
 */
export function getSourceFromUrl(): FunnelSource | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');

  if (
    utmSource === 'gov_engine' ||
    utmSource === 'linkedin_post' ||
    utmSource === 'reddit_post' ||
    utmSource === 'seo' ||
    utmSource === 'direct' ||
    utmSource === 'email' ||
    utmSource === 'affiliate'
  ) {
    return utmSource as FunnelSource;
  }

  return null;
}

/**
 * Add funnel tracking parameters to a URL
 *
 * @example
 * const url = addFunnelParams('https://govchain.us', {
 *   prospectId: 'prospect_123',
 *   source: 'gov_engine',
 *   medium: 'email',
 *   campaign: 'campaign_5'
 * })
 * // Returns: https://govchain.us?prospect_id=prospect_123&utm_source=gov_engine&utm_medium=email&utm_campaign=campaign_5
 */
export function addFunnelParams(
  baseUrl: string,
  {
    prospectId,
    source,
    medium,
    campaign,
  }: {
    prospectId: string;
    source: FunnelSource;
    medium?: string;
    campaign?: string;
  }
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('prospect_id', prospectId);
  url.searchParams.set('utm_source', source);
  if (medium) url.searchParams.set('utm_medium', medium);
  if (campaign) url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}

/**
 * Generate funnel-tracked Calendly URL
 *
 * @example
 * const url = getCalendlyUrl('calendly.com/john', 'prospect_123', 'gov_engine')
 * // Returns: calendly.com/john?name=prospect_123
 */
export function getCalendlyUrl(
  baseCalendlyUrl: string,
  prospectId: string,
  source: FunnelSource
): string {
  const url = new URL(baseCalendlyUrl);

  // Calendly uses name field to capture prospect ID
  url.searchParams.set('name', prospectId);

  // Add source as custom field if supported
  url.searchParams.set('utm_source', source);

  return url.toString();
}
