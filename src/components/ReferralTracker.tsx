'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Capture referral attribution from the URL into cookies the checkout reads.
 *
 * Two distinct mechanisms, kept separate so they don't collide:
 *   • ?ref= / ?aff=  → `aff_ref` cookie  → B2B affiliate (cash payout)
 *   • ?refer= / ?invite= → `ref_code` cookie → user-to-user referral (account credit)
 *
 * (Previously this wrote `qron_referred_by`, which neither middleware nor
 * checkout read — so client-side affiliate attribution was silently dead.)
 */
export function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const setCookie = (name: string, value: string) => {
      const expires = new Date();
      expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      try { localStorage.setItem(name, value); } catch { /* ignore */ }
    };

    const affiliateId = searchParams.get('ref') || searchParams.get('aff');
    if (affiliateId) {
      setCookie('aff_ref', affiliateId);
      console.log('[referral] Tracked affiliate:', affiliateId);
    }

    const referralCode = searchParams.get('refer') || searchParams.get('invite');
    if (referralCode) {
      setCookie('ref_code', referralCode);
      console.log('[referral] Tracked user referral:', referralCode);
    }
  }, [searchParams]);

  return null;
}
