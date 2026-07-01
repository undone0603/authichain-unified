import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const HS_BASE = 'https://api.hubapi.com';

async function upsertHubSpotDeal(
  { name, email, company, message, interest }: Record<string, string | undefined>,
  token: string,
  ownerId: string,
) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const [firstName, ...rest] = (name ?? '').split(' ');
  const lastName = rest.join(' ');

  // Create contact — handle 409 (already exists) gracefully
  let contactId: string | undefined;
  const cRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: 'POST', headers,
    body: JSON.stringify({ properties: { email, firstname: firstName, lastname: lastName, company: company ?? '' } }),
  });
  if (cRes.ok) {
    contactId = (await cRes.json()).id;
  } else if (cRes.status === 409) {
    const err = await cRes.json();
    const m = (err.message as string)?.match(/ID:\s*(\d+)/);
    if (m) {
      contactId = m[1];
    } else {
      const sRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
        method: 'POST', headers,
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }], limit: 1 }),
      });
      const sData = await sRes.json();
      contactId = sData.results?.[0]?.id;
    }
  } else {
    console.warn('[api/book] HubSpot contact error:', cRes.status);
  }

  // Create deal
  const dRes = await fetch(`${HS_BASE}/crm/v3/objects/deals`, {
    method: 'POST', headers,
    body: JSON.stringify({
      properties: {
        dealname: `Demo Request — ${name} @ ${company ?? 'Unknown'}`,
        dealstage: 'appointmentscheduled',
        hubspot_owner_id: ownerId,
        pipeline: 'default',
        ...(message ? { description: message } : {}),
      },
    }),
  });
  if (!dRes.ok) {
    console.warn('[api/book] HubSpot deal error:', dRes.status);
    return;
  }
  const deal = await dRes.json();

  // Associate deal → contact (associationTypeId 3 = deal_to_contact)
  if (contactId) {
    await fetch(`${HS_BASE}/crm/v4/objects/deals/${deal.id}/associations/contacts/${contactId}/3`, {
      method: 'PUT', headers,
    }).catch((e: any) => console.warn('[api/book] HubSpot association error:', e?.message));
  }

  return deal.id as string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, message, interest, prospect_id, utm_campaign } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
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

    // Create HubSpot contact + deal (optional — degrades gracefully, fire-and-forget)
    const hsToken = process.env.HUBSPOT_TOKEN ?? process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const hsOwner = process.env.HUBSPOT_OWNER_ID ?? '87978084';
    if (hsToken) {
      upsertHubSpotDeal({ name, email, company, message, interest }, hsToken, hsOwner)
        .catch((e: any) => console.warn('[api/book] HubSpot pipeline error:', e?.message));
    }

    // Send notification to team via Resend (optional — degrades gracefully)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from   = process.env.OUTREACH_FROM_EMAIL ?? 'hello@authichain.com';
      const notify = process.env.SALES_NOTIFY_EMAIL  ?? 'hello@authichain.com';

      await resend.emails.send({
        from,
        to: notify,
        subject: `Demo request: ${name} @ ${company}`,
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
