import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

// Called by Stripe webhook on invoice.payment_failed OR daily cron for past_due cleanup
export async function POST(req: NextRequest) {
  const { user_id, stripe_customer_id, invoice_url, amount_due, attempt_count } = await req.json();
  if (!user_id && !stripe_customer_id) return NextResponse.json({ error: 'user_id or stripe_customer_id required' }, { status: 400 });

  let email: string | null = null;
  let name: string | null = null;

  if (user_id) {
    const { data: user } = await supabase.from('users').select('email, name').eq('id', user_id).single();
    email = user?.email || null;
    name = user?.name || null;
  } else if (stripe_customer_id) {
    const customer = await stripe.customers.retrieve(stripe_customer_id) as any;
    email = customer.email;
    name = customer.name;
  }

  if (!email) return NextResponse.json({ error: 'Could not find user email' }, { status: 404 });

  // Generate Stripe billing portal session for easy payment update
  let portalUrl = 'https://qron.space/billing';
  try {
    if (stripe_customer_id) {
      const session = await stripe.billingPortal.sessions.create({
        customer: stripe_customer_id,
        return_url: 'https://qron.space/dashboard',
      });
      portalUrl = session.url;
    }
  } catch {}

  const isFirstFailure = !attempt_count || attempt_count <= 1;
  const subject = isFirstFailure
    ? 'Payment failed for your QRON subscription'
    : `Action required: QRON subscription payment failed (attempt ${attempt_count})`;

  await resend.emails.send({
    from: 'QRON Billing <billing@qron.space>',
    to: email,
    subject,
    html: `<h2>Hi ${name || 'there'},</h2>
<p>We were unable to process your QRON subscription payment of <strong>$${((amount_due || 0) / 100).toFixed(2)}</strong>.</p>
<p>Your QR codes and analytics remain active, but your account will be paused if payment is not resolved within 3 days.</p>
<p><a href="${portalUrl}" style="background:#ef4444;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Update Payment Method</a></p>
${invoice_url ? `<p>Or <a href="${invoice_url}">pay the invoice directly</a>.</p>` : ''}
<p>If you have questions, reply to this email and we'll help immediately.</p>`,
  });

  await supabase.from('payment_recovery_log').insert({
    user_id,
    stripe_customer_id,
    amount_due,
    attempt_count: attempt_count || 1,
    email_sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, email_sent_to: email });
}
