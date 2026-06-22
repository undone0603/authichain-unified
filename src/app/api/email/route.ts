import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const FROM_QRON = 'QRON Platform <ops@qron.space>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await getAdmin()
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();
  return (data as { email?: string } | null)?.email ?? null;
}

export async function POST(req: NextRequest) {
  // Validate internal secret
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: { type: string; user_id?: string; email?: string; plan?: string } = await req.json();
  const { type, user_id, email: directEmail, plan } = body;

  const toEmail = directEmail ?? (user_id ? await getUserEmail(user_id) : null);
  if (!toEmail) {
    return NextResponse.json({ error: 'No recipient resolved' }, { status: 400 });
  }

  let result;

  switch (type) {
    case 'subscription_confirmed': {
      const planLabel = plan ? plan.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Pro';
      result = await sendEmail({
        from: FROM_QRON,
        to: toEmail,
        subject: `Welcome to QRON ${planLabel} — you're live`,
        html: `
          <div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;border:1px solid #c9a227">
            <h1 style="color:#c9a227;margin:0 0 8px">You're subscribed.</h1>
            <p style="color:#9e9e9e;margin:0 0 24px">QRON ${planLabel} is now active on your account.</p>
            <a href="${APP_URL}/dashboard" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Open Dashboard</a>
            <hr style="border:none;border-top:1px solid #222;margin:32px 0"/>
            <p style="font-size:12px;color:#444">Questions? Reply to this email or reach us at support@qron.space</p>
          </div>`,
        text: `Welcome to QRON ${planLabel}. Your subscription is now active.\n\nDashboard: ${APP_URL}/dashboard`,
      });
      break;
    }

    case 'payment_failed': {
      result = await sendEmail({
        from: FROM_QRON,
        to: toEmail,
        subject: 'Action required: your QRON payment failed',
        html: `
          <div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;border:1px solid #ef5350">
            <h1 style="color:#ef5350;margin:0 0 8px">Payment failed</h1>
            <p style="color:#9e9e9e;margin:0 0 24px">We couldn't process your last QRON payment. Update your card to keep your subscription active.</p>
            <a href="${APP_URL}/dashboard/billing" style="display:inline-block;background:#ef5350;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Update Payment Method</a>
            <hr style="border:none;border-top:1px solid #222;margin:32px 0"/>
            <p style="font-size:12px;color:#444">If you need help, reply to this email or visit ${APP_URL}/support</p>
          </div>`,
        text: `Your QRON payment failed. Update your payment method here: ${APP_URL}/dashboard/billing`,
      });
      break;
    }

    case 'trial_expiring': {
      result = await sendEmail({
        from: FROM_QRON,
        to: toEmail,
        subject: 'Your QRON trial ends in 3 days',
        html: `
          <div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;border:1px solid #c9a227">
            <h1 style="color:#c9a227;margin:0 0 8px">Trial ending soon</h1>
            <p style="color:#9e9e9e;margin:0 0 16px">Your QRON free trial ends in <strong style="color:#fff">3 days</strong>. After that, your account reverts to the free tier (10 generations/month).</p>
            <p style="color:#9e9e9e;margin:0 0 24px">Subscribe now to keep all your generations and premium features — no interruption.</p>
            <a href="${APP_URL}/#pricing" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">See Plans</a>
            <hr style="border:none;border-top:1px solid #222;margin:32px 0"/>
            <p style="font-size:12px;color:#444">Already subscribed? You're all set. This is a reminder only.</p>
          </div>`,
        text: `Your QRON trial ends in 3 days. Subscribe to keep your access: ${APP_URL}/#pricing`,
      });
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 });
  }

  if (!result.ok) {
    console.error(`[email API] Failed to send ${type} to ${toEmail}: ${result.error}`);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, provider: result.provider });
}
