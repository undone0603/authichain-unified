'use client';

/**
 * FunnelTracker
 *
 * Client-side component that automatically tracks page visits
 * when a prospect lands from email/social campaigns.
 *
 * Usage:
 * Place at root of page layout or in page component.
 *
 * <FunnelTracker stage="visit_landing_page" />
 */

import { useEffect, useRef } from 'react';
import { trackFunnelEvent, getProspectIdFromUrl, getSourceFromUrl } from '@/lib/funnel-tracking';

interface FunnelTrackerProps {
  stage?: 'visit_landing_page' | 'start_checkout' | 'link_clicked';
  metadata?: Record<string, unknown>;
}

export function FunnelTracker({ stage = 'visit_landing_page', metadata = {} }: FunnelTrackerProps) {
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Prevent double-tracking on React strict mode
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;

    const prospectId = getProspectIdFromUrl();
    const source = getSourceFromUrl();

    if (prospectId && source) {
      trackFunnelEvent({
        prospectId,
        stage,
        source,
        metadata: {
          pathname: window.location.pathname,
          referrer: document.referrer,
          ...metadata,
        },
      }).catch((error) => {
        // Silently fail - don't disrupt user experience
        console.debug('[FunnelTracker] Failed to track event:', error);
      });
    }
  }, [stage, metadata]);

  // Component is invisible
  return null;
}
