import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/require-admin';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import {
  applyFeedFilters,
  isSiFeedSource,
  normalizeAutomationLog,
  SI_FEED_SOURCES,
  type AutomationLog,
} from '../../../../lib/si-feed';
import { createClient } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

type Cursor = { created_at: string; id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeCursor(value: string | null): Cursor | null | false {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (
      typeof parsed.created_at !== 'string' ||
      new Date(parsed.created_at).toISOString() !== parsed.created_at ||
      !UUID.test(parsed.id)
    ) {
      return false;
    }
    return parsed;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createClient();
    const auth = await requireAdmin(sessionClient);
    const isOwner = !(auth instanceof NextResponse);
    if (!isOwner && auth.status !== 401 && auth.status !== 403) return auth;

    const admin = getSupabaseAdmin();
    let visibleSources = [...SI_FEED_SOURCES];

    if (!isOwner) {
      const { data: consents, error: consentError } = await admin
        .from('si_feed_consents')
        .select('source')
        .eq('share_public', true);
      if (consentError) throw consentError;
      visibleSources = Array.from(
        new Set((consents ?? []).map(row => row.source).filter(isSiFeedSource))
      );
    }

    const params = request.nextUrl.searchParams;
    const source = params.get('source');
    if (source && source !== 'all' && !isSiFeedSource(source)) {
      return NextResponse.json({ error: 'Unsupported source filter' }, { status: 400 });
    }
    const since = params.get('since');
    if (since && !Number.isFinite(Date.parse(since))) {
      return NextResponse.json({ error: 'since must be a valid timestamp' }, { status: 400 });
    }
    const limitValue = Number(params.get('limit') ?? 50);
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) {
      return NextResponse.json({ error: 'limit must be an integer from 1 to 100' }, { status: 400 });
    }
    const cursor = decodeCursor(params.get('cursor'));
    if (cursor === false) {
      return NextResponse.json({ error: 'cursor is invalid' }, { status: 400 });
    }

    let query = admin
      .from('automation_logs')
      .select('id, workflow_name, trigger_type, status, created_at')
      .gte(
        'created_at',
        since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1000);

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const events = applyFeedFilters(
      ((data ?? []) as AutomationLog[]).map(normalizeAutomationLog),
      {
        source,
        agent: params.get('agent'),
        severity: params.get('severity'),
        entity: params.get('entity'),
      }
    ).filter(event => visibleSources.includes(event.source));
    const page = events.slice(0, limitValue);
    const last = page.at(-1);
    const nextCursor =
      last && events.length >= limitValue
        ? Buffer.from(
            JSON.stringify({ created_at: last.timestamp, id: last.id }),
            'utf8'
          ).toString('base64url')
        : null;

    return NextResponse.json(
      {
        events: page,
        next_cursor: nextCursor,
        generated_at: new Date().toISOString(),
        refresh_after_seconds: 30,
        sources: isOwner ? SI_FEED_SOURCES : visibleSources,
        visibility: isOwner ? 'private' : 'consented-public',
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to load the SI Feed' }, { status: 503 });
  }
}
