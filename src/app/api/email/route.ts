import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';

type EmailType = 'welcome' | 'trial_day3' | 'trial_day7' | 'trial_expiring' | 'subscription_confirmed' | 'payment_failed' | 'cancellation';

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'QRON <hello@qron.space>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${await res.text()}`);
  return res.json();
}

function buildEmailHTML(type: EmailType, data: Record<string, any>): { subject: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';
  const dashUrl = `${appUrl}/dashboard`;
  const pricingUrl = `${appUrl}/pricing`;

  switch (type) {
    case 'welcome':
      return {
        subject: 'Welcome to QRON — Your AI QR codes are ready',
        html: `<h1>Welcome to QRON, ${data.name || 'there'}!</h1>
<p>You're now set up and ready to create stunning, intelligent QR codes.</p>
<p><strong>Get started in 3 steps:</strong></p>
<ol>
  <li>✅ <a href="${dashUrl}">Open your dashboard</a></li>
  <li>🎨 Generate your first AI-styled QR code</li>
  <li>📊 Share it and track real-time scans</li>
</ol>
<p>Your free trial gives you 14 days of full Pro access. No credit card needed yet.</p>
<p><a href="${dashUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Go to Dashboard</a></p>
<p>Reply to this email any time — we respond fast.</p>`,
      };
    case 'trial_day3':
      return {
        subject: 'Day 3 of your QRON trial — tips to get more scans',
        html: `<h2>You're 3 days in — here's how to get the most from QRON</h2>
<p>Hi ${data.name || 'there'},</p>
<p>Quick wins to boost your QR scan rates:</p>
<ul>
  <li>🎨 Try the AI art styles — branded QR codes get 3x more scans</li>
  <li>📊 Enable UTM tracking for each code</li>
  <li>🔄 Set up dynamic redirects so you can change the URL without reprinting</li>
</ul>
<p><a href="${dashUrl}">Continue building →</a></p>`,
      };
    case 'trial_day7':
      return {
        subject: 'Your QRON trial is halfway done — lock in your plan',
        html: `<h2>7 days left on your free trial</h2>
<p>Hi ${data.name || 'there'},</p>
<p>You've been building with QRON for a week. To keep all your QR codes live and trackable after the trial, pick a plan before it expires.</p>
<p>Starter at <strong>$29/mo</strong> keeps everything running.</p>
<p><a href="${pricingUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Choose a Plan</a></p>`,
      };
    case 'trial_expiring':
      return {
        subject: '⚠️ Your QRON trial expires in 2 days',
        html: `<h2>Your trial expires in 2 days</h2>
<p>Hi ${data.name || 'there'},</p>
<p>Don't lose access to your QR codes and analytics. Upgrade now to keep everything live.</p>
<p><a href="${pricingUrl}" style="background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Upgrade Before Expiry</a></p>`,
      };
    case 'subscription_confirmed':
      return {
        subject: '✅ QRON subscription confirmed — you\'re all set',
        html: `<h2>You're subscribed to QRON ${data.plan || ''}!</h2>
<p>Hi ${data.name || 'there'},</p>
<p>Your ${data.plan || ''} plan is now active. Here's what's unlocked:</p>
<ul>
  <li>🟢 All QR codes are live</li>
  <li>📊 Full analytics dashboard</li>
  <li>🎨 AI art styles enabled</li>
</ul>
<p><a href="${dashUrl}">Go to Dashboard</a></p>
<p>Questions? Reply to this email anytime.</p>`,
      };
    case 'payment_failed':
      return {
        subject: '❌ Action required: QRON payment failed',
        html: `<h2>We couldn't process your payment</h2>
<p>Hi ${data.name || 'there'},</p>
<p>Your latest QRON payment failed. Please update your payment method to keep your subscription active.</p>
<p><a href="${appUrl}/billing" style="background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Update Payment Method</a></p>`,
      };
    case 'cancellation':
      return {
        subject: 'Your QRON subscription has been cancelled',
        html: `<h2>We're sorry to see you go</h2>
<p>Hi ${data.name || 'there'},</p>
<p>Your subscription has been cancelled. Your QR codes will remain active until the end of your billing period.</p>
<p>Changed your mind? <a href="${pricingUrl}">Reactivate here</a></p>`,
      };
    default:
      return { subject: 'QRON notification', html: '<p>No content</p>' };
  }
}

export async function POST(req: NextRequest) {
  try {
    // Internal or webhook-triggered only
    const secret = req.headers.get('x-internal-secret');
    const authHeader = req.headers.get('authorization');
    const isInternal = secret === process.env.INTERNAL_API_SECRET;
    const isAuthed = !!authHeader;

    if (!isInternal && !isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, user_id, email, name, plan, override_data } = body;

    if (!type || !email) {
      return NextResponse.json({ error: 'Missing required fields: type, email' }, { status: 400 });
    }

    const data = { name, plan, ...override_data };
    const { subject, html } = buildEmailHTML(type as EmailType, data);

    const result = await sendEmail(email, subject, html);

    // Log the email send
    await supabase.from('email_log').insert({
      user_id: user_id || null,
      email_to: email,
      email_type: type,
      subject,
      status: 'sent',
      resend_id: result.id || null,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, email_id: result.id, type, to: email });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
