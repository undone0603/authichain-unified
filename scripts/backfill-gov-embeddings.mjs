// scripts/backfill-gov-embeddings.mjs
// Backfills HuggingFace bge-small-en-v1.5 embeddings (384-dim) into gov_opportunities.
// Run: node --env-file=.env.local scripts/backfill-gov-embeddings.mjs

import { createClient } from '@supabase/supabase-js';

const HF_TOKEN = process.env.HF_TOKEN_PRIMARY;
const HF_URL = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5';
const MODEL = 'BAAI/bge-small-en-v1.5';
const PAGE_SIZE = 100;
const EMBED_BATCH = 32; // HF free tier is happy with 32 at a time

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeText(row) {
  return [row.title, row.agency, row.naics_code, row.description]
    .filter(Boolean).join(' ').slice(0, 2000);
}

async function embedBatch(texts) {
  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HF API ${res.status}: ${err}`);
  }
  return res.json(); // returns float[][] — one embedding per input
}

async function saveBatch(rows, embeddings) {
  const now = new Date().toISOString();
  await Promise.all(rows.map((row, i) =>
    supabase.from('gov_opportunities').update({
      embedding: embeddings[i],
      embedding_model: MODEL,
      embedded_at: now,
    }).eq('notice_id', row.notice_id)
  ));
}

async function run() {
  if (!HF_TOKEN) { console.error('HF_TOKEN_PRIMARY not set'); process.exit(1); }

  console.log('Starting gov_opportunities embedding backfill (HuggingFace BAAI/bge-small-en-v1.5)...');
  let total = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('gov_opportunities')
      .select('notice_id, title, agency, naics_code, description')
      .is('embedding', null)
      .limit(PAGE_SIZE);

    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!rows || rows.length === 0) break;

    for (let i = 0; i < rows.length; i += EMBED_BATCH) {
      const chunk = rows.slice(i, i + EMBED_BATCH);
      const texts = chunk.map(makeText);
      const embeddings = await embedBatch(texts);
      await saveBatch(chunk, embeddings);
      total += chunk.length;
      process.stdout.write(`\r  Embedded ${total} rows...`);
    }

    if (rows.length < PAGE_SIZE) break;
  }

  console.log(`\nDone. Total embedded: ${total}`);
}

run().catch(err => { console.error('\nError:', err.message); process.exit(1); });
