export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  try {
    const admin = getAdmin();

    const csvPath = join(process.cwd(), 'gov_pursue_list.csv');
    const raw = readFileSync(csvPath, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim());
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^,]+)/g) || [];
      const notice_id = values[0]?.replace(/"/g, '').trim();
      const title = values[1]?.replace(/"/g, '').trim();
      const agency = values[2]?.replace(/"/g, '').trim();
      const deadline = values[3]?.replace(/"/g, '').trim();
      const fit_score = parseInt(values[4]?.replace(/"/g, '').trim() || '0');

      if (!notice_id || !title) { skipped++; continue; }

      const { error } = await admin.from('gov_opportunities').upsert({
        notice_id,
        title,
        agency,
        deadline,
        fit_score,
        sam_url: `https://sam.gov/opp/${notice_id}/view`,
        govchain_url: `https://govchain.us/opportunities/${notice_id}`,
        ingested_at: new Date().toISOString(),
        status: fit_score >= 65 ? 'scored' : 'new',
      }, { onConflict: 'notice_id' });

      if (error) { skipped++; } else { imported++; }
    }

    if (imported > 0) {
      await admin.from('automation_logs').insert({
        workflow_name: 'gov_csv_bulk_import',
        status: 'completed',
        payload: { imported, skipped, total: lines.length - 1 },
      });
    }

    return NextResponse.json({
      imported,
      skipped,
      total: lines.length - 1,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = getAdmin();

    const { data: opps, error } = await admin
      .from('gov_opportunities')
      .select('notice_id, title, agency, deadline, fit_score, status')
      .order('fit_score', { ascending: false })
      .limit(50);

    if (error) throw error;

    const { count: total } = await admin
      .from('gov_opportunities')
      .select('notice_id', { count: 'exact', head: true });

    const { count: highFit } = await admin
      .from('gov_opportunities')
      .select('notice_id', { count: 'exact', head: true })
      .gte('fit_score', 65);

    return NextResponse.json({
      total: total || 0,
      high_fit: highFit || 0,
      top_opportunities: opps || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
