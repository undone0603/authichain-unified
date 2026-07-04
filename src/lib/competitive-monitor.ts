import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const COMPETITORS = [
  { name: 'scantrust',   url: 'https://www.scantrust.com/' },
  { name: 'vechain',     url: 'https://www.vechain.org/' },
  { name: 'circularise', url: 'https://www.circularise.com/' },
  { name: 'avery-dennison-atma', url: 'https://atma.io/' },
];

const MONITORED_KEYWORDS = [
  'pricing', 'price', 'launch', 'product', 'feature', 'announcement',
  'eu dpp', 'digital product passport', 'blockchain', 'supply chain',
  'government', 'sbir', 'certification',
];

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function extractExcerpt(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  let best = '';
  for (const kw of MONITORED_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      best = text.slice(Math.max(0, idx - 80), idx + 200);
      break;
    }
  }
  return best || text.slice(0, 300);
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AuthiChain-Monitor/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function runCompetitiveMonitor(): Promise<{
  checked: number;
  changes: number;
  competitors: string[];
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[competitive-monitor] Supabase not configured');
    return { checked: 0, changes: 0, competitors: [] };
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  let checked = 0;
  let changes = 0;
  const changedCompetitors: string[] = [];

  for (const { name, url } of COMPETITORS) {
    const html = await fetchPage(url);
    if (!html) {
      console.warn(`[competitive-monitor] Failed to fetch ${name}`);
      continue;
    }

    checked++;
    const hash = hashContent(html);

    const { data: existing } = await admin
      .from('competitive_snapshots')
      .select('content_hash')
      .eq('competitor', name)
      .order('detected_at', { ascending: false })
      .limit(1)
      .single();

    if (existing && existing.content_hash === hash) {
      console.log(`[competitive-monitor] ${name}: no change`);
      continue;
    }

    changes++;
    changedCompetitors.push(name);
    const excerpt = extractExcerpt(html);

    await admin.from('competitive_snapshots').insert({
      competitor: name,
      url,
      content_hash: hash,
      excerpt,
      changes: existing ? { previous_hash: existing.content_hash } : {},
    });

    await admin.from('automation_logs').insert({
      workflow_name: 'agentz_competitive_change',
      trigger_type: 'cron',
      status: 'success',
      payload: JSON.stringify({ competitor: name, url, excerpt: excerpt.slice(0, 200) }),
    });

    console.log(`[competitive-monitor] ${name}: CHANGED — ${excerpt.slice(0, 100)}`);
  }

  return { checked, changes, competitors: changedCompetitors };
}
