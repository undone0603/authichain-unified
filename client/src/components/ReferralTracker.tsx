import { useEffect } from 'react';

/** Captures ?ref= or ?aff= params and persists them for 30 days (cookie + localStorage). */
export function ReferralTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const affiliateId = params.get('ref') || params.get('aff');
    if (!affiliateId) return;

    const expires = new Date();
    expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
    document.cookie = `ac_referred_by=${affiliateId};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    try { localStorage.setItem('ac_referred_by', affiliateId); } catch {}
  }, []);

  return null;
}
