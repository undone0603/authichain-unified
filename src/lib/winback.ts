/**
 * Win-back retention campaign.
 *
 * Scans recently-cancelled profiles and emails a brand-aware "come back" offer
 * at day 7 and day 30 after cancellation. Deduped via automation_logs the same
 * way dunning is, so each step sends at most once per user.
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
import { renderBillingEmail } from './billing-emails';
import { BRANDS, DEFAULT_BRAND, type BrandId } from '@shared/brands';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function brandOf(value: string | null | undefined): BrandId {
  return value && value in BRANDS ? (value as BrandId) : DEFAULT_BRAND;
}

type WinbackStep = 'day_7' | 'day_30';

function daysSince(isoDate: string | null): number {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

/** Returns the due win-back step for a given cancellation age, or null. */
function stepForAge(age: number): WinbackStep | null {
  if (age >= 30 && age < 45) return 'day_30';
  if (age >= 7 && age < 14) return 'day_7';
  return null;
}

export async function runWinbackCampaign(): Promise<{ checked: number; sent: number }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { checked: 0, sent: 0 };
  }
  const admin = getAdmin();

  const { data: cancelled } = await admin
    .from('profiles')
    .select('id, email, full_name, subscription_plan, subscription_status, cancelled_at, brand')
    .eq('subscription_status', 'cancelled')
    .not('cancelled_at', 'is', null)
    .limit(200);

  if (!cancelled || cancelled.length === 0) return { checked: 0, sent: 0 };

  let sent = 0;

  for (const row of cancelled) {
    const p = row as {
      id: string; email?: string; full_name?: string;
      subscription_plan?: string; cancelled_at?: string; brand?: string;
    };
    if (!p.email) continue;

    const age = daysSince(p.cancelled_at ?? null);
    const step = stepForAge(age);
    if (!step) continue;

    // Dedup: only one email per (user, step).
    const { data: existing } = await admin
      .from('automation_logs')
      .select('id')
      .eq('workflow_name', `winback_${step}`)
      .eq('status', 'success')
      .contains('payload', { user_id: p.id })
      .limit(1);
    if (existing && existing.length > 0) continue;

    const brandId = brandOf(p.brand);
    const mail = renderBillingEmail('winback', brandId, {
      name: p.full_name?.split(' ')[0] || undefined,
      days: age,
      offerCode: step === 'day_30' ? 'COMEBACK20' : undefined,
    });

    const result = await sendEmail({
      to: p.email,
      from: mail.from,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (result.ok) {
      await admin.from('automation_logs').insert({
        workflow_name: `winback_${step}`,
        trigger_type: 'cron',
        status: 'success',
        payload: JSON.stringify({ user_id: p.id, step, brand: brandId, provider: result.provider }),
      });
      sent++;
    }
  }

  return { checked: cancelled.length, sent };
}
