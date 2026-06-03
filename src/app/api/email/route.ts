export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'not_configured'
);

const FROM = 'AuthiChain <noreply@authichain.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://authichain.com';

/**
 * POST /api/email
 * Internal transactional email dispatcher. Called by the Stripe webhook handler.
 * Protected by x-internal-secret header.
 *
 * Body: { type, user_id, email?, plan? }
 * Types: subscription_confirmed | payment_failed | trial_expiring
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    type: string;
    user_id?: string;
    email?: string;
    plan?: string;
  };

  const { type, user_id, plan } = body;
  let toEmail = body.email;

  // Resolve email from Supabase if not provided directly
  if (!toEmail && user_id) {
    const { data: { user } } = await admin.auth.admin.getUserById(user_id);
    toEmail = user?.email;
  }

  if (!toEmail) {
    return NextResponse.json({ error: 'Could not resolve recipient email' }, { status: 400 });
  }

  let subject = '';
  let html = '';

  switch (type) {
    case 'subscription_confirmed': {
      const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'your';
      subject = `Welcome to AuthiChain ${planLabel} — you're all set`;
      html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#6366f1">Your subscription is active</h2>
          <p>Thanks for subscribing to <strong>AuthiChain ${planLabel}</strong>. Your account is now fully unlocked.</p>
          <p>Here's what you can do next:</p>
          <ul>
            <li>Generate AI-styled QRON codes from your <a href="${APP_URL}/dashboard">dashboard</a></li>
            <li>Track scans and analytics in real time</li>
            <li>Use the API to generate QRONs programmatically</li>
          </ul>
          <p style="margin-top:24px">
            <a href="${APP_URL}/dashboard" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
              Go to Dashboard
            </a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:32px">
            Questions? Reply to this email or visit <a href="${APP_URL}/docs">our docs</a>.
          </p>
        </div>`;
      break;
    }

    case 'payment_failed': {
      subject = 'Action required: your AuthiChain payment failed';
      html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#ef4444">Payment failed</h2>
          <p>We weren't able to process your latest AuthiChain payment. Your subscription will be paused if this isn't resolved.</p>
          <p style="margin-top:24px">
            <a href="${APP_URL}/dashboard/billing" style="background:#ef4444;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
              Update Payment Method
            </a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:32px">
            If you have questions, reply to this email and we'll sort it out.
          </p>
        </div>`;
      break;
    }

    case 'trial_expiring': {
      subject = 'Your AuthiChain trial ends in 3 days';
      html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#f59e0b">Your trial ends soon</h2>
          <p>Your AuthiChain free trial ends in <strong>3 days</strong>. After that you'll lose access to:</p>
          <ul>
            <li>AI-generated QRON art styles</li>
            <li>Blockchain anchoring on Polygon</li>
            <li>Scan analytics and real-time tracking</li>
            <li>API access for programmatic generation</li>
          </ul>
          <p style="margin-top:24px">
            <a href="${APP_URL}/pricing" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
              Keep My Access — View Plans
            </a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:32px">
            Use code <strong>EARLYBIRD20</strong> for 20% off your first 3 months.
          </p>
        </div>`;
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 });
  }

  const result = await sendEmail({ to: toEmail, from: FROM, subject, html });

  if (!result.ok) {
    console.error(`[email] Failed to send email:`, result.error);
    return NextResponse.json({ error: result.error, provider: result.provider }, { status: 502 });
  }

  return NextResponse.json({ success: true, type, provider: result.provider });
}
