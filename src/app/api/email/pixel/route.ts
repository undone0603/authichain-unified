import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1×1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/email/pixel?prospect_id=XXX&campaign=YYY&source=ZZZ
 *
 * Embed in outgoing emails as a 1×1 tracking pixel:
 *   <img src="https://authichain.com/api/email/pixel?prospect_id=XXX&source=gov_engine&campaign=q3" width="1" height="1" />
 *
 * Logs an `email_opened` funnel event when the email client fetches the image.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prospectId = searchParams.get('prospect_id');
  const source = searchParams.get('source') ?? 'email';
  const campaign = searchParams.get('campaign') ?? undefined;

  if (prospectId) {
    try {
      await getSupabase().from('funnel_events').insert({
        prospect_id: prospectId,
        stage: 'email_opened',
        source,
        metadata: {
          ...(campaign ? { campaign } : {}),
          user_agent: request.headers.get('user-agent') ?? undefined,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Silently fail — never break email rendering over a tracking error.
      console.error('[email-pixel] funnel insert failed:', e);
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      // Instruct clients not to cache so each open is recorded.
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
