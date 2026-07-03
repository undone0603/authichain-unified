import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
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

type Step = 'day_3' | 'day_7' | 'day_14';

const SUBJECTS: Record<Step, string> = {
  day_3:  'Action required: your payment failed',
  day_7:  'Reminder: your account is past due',
  day_14: 'Final notice: account at risk of suspension',
};

function buildBody(step: Step, name: string, plan: string, appUrl: string): { html: string; text: string } {
  const firstName = name || 'there';
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Pro';
  const billingUrl = `${appUrl}/dashboard/billing`;

  const urgency: Record<Step, { color: string; headline: string; body: string }> = {
    day_3: {
      color: '#f59e0b',
      headline: 'Payment failed',
      body: `We couldn't process your ${planLabel} payment. Update your card to keep your access.`,
    },
    day_7: {
      color: '#ef5350',
      headline: 'Account past due',
      body: `Your ${planLabel} payment is 7 days overdue. Your account will be suspended without action.`,
    },
    day_14: {
      color: '#c62828',
      headline: 'Final notice',
      body: `Your ${planLabel} payment is 14 days overdue. Update billing now to avoid immediate suspension.`,
    },
  };

  const u = urgency[step];
  return {
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;padding:28px;border-radius:12px;border:1px solid ${u.color}">
      <h2 style="color:${u.color};margin:0 0 12px">${u.headline}</h2>
      <p>Hi ${firstName},</p>
      <p>${u.body}</p>
      <a href="${billingUrl}" style="display:inline-block;background:${u.color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Update Payment Method</a>
      <p style="color:#555;font-size:12px">Questions? Reply to this email.</p>
    </div>`,
    text: `Hi ${firstName}, ${u.body}\n\nUpdate billing: ${billingUrl}`,
  };
}

function daysSince(isoDate: string | null): number {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

export async function runDunningEscalation(): Promise<{ checked: number; remindersSent: number }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { checked: 0, remindersSent: 0 };
  }
  const admin = getAdmin();

  // Fetch past_due profiles with their last_payment_at
  const { data: pastDue } = await admin
    .from('profiles')
    .select('id, email, full_name, subscription_plan, subscription_status, last_payment_at, brand')
    .eq('subscription_status', 'past_due')
    .limit(100);

  if (!pastDue || pastDue.length === 0) return { checked: 0, remindersSent: 0 };

  let remindersSent = 0;

  for (const profile of pastDue) {
    const age = daysSince((profile as { last_payment_at?: string }).last_payment_at ?? null);
    let step: Step | null = null;
    if (age >= 14)      step = 'day_14';
    else if (age >= 7)  step = 'day_7';
    else if (age >= 3)  step = 'day_3';
    if (!step) continue;

    // De-duplicate: check if we already sent this step
    const { data: existing } = await admin
      .from('automation_logs')
      .select('id')
      .eq('workflow_name', `dunning_${step}`)
      .eq('status', 'success')
      .contains('payload', { user_id: (profile as { id: string }).id })
      .limit(1);

    if (existing && existing.length > 0) continue;

    const p = profile as { id: string; email?: string; full_name?: string; subscription_plan?: string; brand?: string };
    if (!p.email) continue;

    const brand = BRANDS[brandOf(p.brand)];
    const { html, text } = buildBody(step, p.full_name?.split(' ')[0] ?? '', p.subscription_plan ?? '', brand.billing.appUrl);
    const result = await sendEmail({
      from: brand.billing.emailFrom,
      to: p.email,
      subject: SUBJECTS[step],
      html,
      text,
    });

    if (result.ok) {
      await admin.from('automation_logs').insert({
        workflow_name: `dunning_${step}`,
        trigger_type: 'cron',
        status: 'success',
        payload: JSON.stringify({ user_id: p.id, step, provider: result.provider }),
      });
      remindersSent++;
    }
  }

  return { checked: pastDue.length, remindersSent };
}
