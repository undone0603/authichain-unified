import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, message, interest, prospect_id, utm_campaign } = body;

    if (!name || !email || !company) {
      return NextResponse.json({ error: 'name, email, and company are required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
    );

    // Upsert into leads table — if this contact came from outreach, upgrade their status
    await supabase.from('leads').upsert({
      email,
      name,
      company,
      source:   prospect_id ? 'b2b_outreach_reply' : 'book_page',
      status:   'demo_requested',
      industry: interest ?? null,
      metadata: {
        message,
        interest,
        prospect_id:  prospect_id ?? null,
        utm_campaign: utm_campaign ?? null,
        booked_at:    new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    }, { onConflict: 'email' });

    // Send notification to team via Resend (optional — degrades gracefully)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from   = process.env.OUTREACH_FROM_EMAIL ?? 'hello@authichain.com';
      const notify = process.env.SALES_NOTIFY_EMAIL  ?? 'hello@authichain.com';

      await resend.emails.send({
        from,
        to: notify,
        subject: `🗓 Demo request: ${name} @ ${company}`,
        html: `
          <p><strong>${name}</strong> (${email}) at <strong>${company}</strong> requested a demo call.</p>
          ${interest ? `<p><strong>Interest:</strong> ${interest}</p>` : ''}
          ${message  ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          ${prospect_id ? `<p><strong>Prospect ID:</strong> ${prospect_id} (originated from cold outreach)</p>` : ''}
          <p><a href="mailto:${email}">Reply directly →</a></p>
        `,
      }).catch((err: any) =>
        console.warn('[api/book] notification email failed:', err?.message),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[api/book] error:', err?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
