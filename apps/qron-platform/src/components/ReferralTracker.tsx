'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Capture affiliate referrals from the URL and store them in a cookie.
 * Looks for ?ref=AFFILIATE_ID or ?aff=...
 */
export function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const affiliateId = searchParams.get('ref') || searchParams.get('aff');
    if (affiliateId) {
      // Store in a cookie that expires in 30 days
      const expires = new Date();
      expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie = `qron_referred_by=${affiliateId};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      
      // Also store in localStorage as fallback
      localStorage.setItem('qron_referred_by', affiliateId);
      
      console.log('[referral] Tracked affiliate:', affiliateId);
    }
  }, [searchParams]);

  return null;
}
