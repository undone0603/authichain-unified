// scripts/ingest-sam.ts
// FIXED: proper ESM .ts file — replaces broken `tsx -e "..."` inline pattern
// Top-level await works correctly here when invoked via `pnpm exec tsx scripts/ingest-sam.ts`
import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const isDryRun = process.env.DRY_RUN === 'true';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const GOVCHAIN_URL = process.env.GOVCHAIN_URL ?? 'https://govchain.us';

// ── Fetch opportunities from SAM.gov API ──────────────────────────────────────
// SAM.gov v2 requires MM/dd/yyyy format and BOTH postedFrom + postedTo.
function samDate(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function fetchSAMOpportunities(): Promise<any[]> {
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    api_key:    process.env.SAM_GOV_API_KEY!,
    limit:      '100',
    postedFrom: samDate(weekAgo),
    postedTo:   samDate(now),
    ptype:      'o',
    q:          'blockchain authentication provenance verification supply chain',
  });

  const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SAM.gov API error: ${res.status} ${res.statusText} — ${body.slice(0, 400)}`);
  }

  const data = await res.json();
  return data.opportunitiesData ?? [];
}

// ── Embed text and store in Pinecone + Supabase ───────────────────────────────
async function embedAndStore(opportunities: any[]): Promise<number> {
  const index = pinecone.index(process.env.PINECONE_INDEX!);
  let count = 0;

  for (const opp of opportunities) {
    const text = [opp.title, opp.description ?? '', opp.naicsCode ?? '']
      .join(' ')
      .slice(0, 8000);

    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const vector = embeddingRes.data[0].embedding;

    if (!isDryRun) {
      await index.upsert([
        {
          id: opp.noticeId,
          values: vector,
          metadata: {
            title:        opp.title,
            agency:       opp.fullParentPathName ?? '',
            deadline:     opp.responseDeadLine ?? '',
            naics:        opp.naicsCode ?? '',
            sam_url:      `https://sam.gov/opp/${opp.noticeId}/view`,
            govchain_url: `${GOVCHAIN_URL}/opportunities/${opp.noticeId}`,
          },
        },
      ]);

      await supabase.from('gov_opportunities').upsert({
        notice_id:    opp.noticeId,
        title:        opp.title,
        agency:       opp.fullParentPathName,
        deadline:     opp.responseDeadLine,
        naics_code:   opp.naicsCode,
        description:  opp.description?.slice(0, 5000),
        sam_url:      `https://sam.gov/opp/${opp.noticeId}/view`,
        govchain_url: `${GOVCHAIN_URL}/opportunities/${opp.noticeId}`,
        ingested_at:  new Date().toISOString(),
        status:       'new',
      });
    }

    count++;
    if (count % 10 === 0) console.log(`  Processed ${count}/${opportunities.length}...`);
  }

  return count;
}

// ── Main (top-level await) ────────────────────────────────────────────────────
console.log('🔍 Fetching SAM.gov opportunities...');
const opportunities = await fetchSAMOpportunities();
console.log(`📦 Fetched ${opportunities.length} opportunities`);

const count = await embedAndStore(opportunities);
console.log(`✅ Ingested ${count} opportunities${isDryRun ? ' (DRY RUN — no writes)' : ''}`);

// Set GitHub Actions output via GITHUB_OUTPUT env file (::set-output is deprecated)
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_OUTPUT, `count=${count}\n`);
}
process.exit(0);
