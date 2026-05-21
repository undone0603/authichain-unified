// scripts/score-opportunities.ts
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - package installed separately
import { Pinecone } from '@pinecone-database/pinecone';
import { chat } from './lib/llm.ts';

const isDryRun  = process.env.DRY_RUN === 'true';
const supabase  = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const pinecone  = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const GOVCHAIN  = process.env.GOVCHAIN_URL ?? 'https://govchain.us';

const AUTHICHAIN_PROFILE = `
AuthiChain is a blockchain-powered product authentication platform.
Products: AuthiChain (product seals/NFTs), QRON (QR code generation),
StrainChain (cannabis supply chain), GovChain (government provenance).
Target agencies: DoD, DHS, FDA, USDA, CBP, GSA.
NAICS: 541511, 541512, 541519, 334111.
Strengths: blockchain provenance, anti-counterfeiting, supply chain visibility,
IoT-linked authentication, zero-trust verification.
`;

async function scoreOpportunities(): Promise<{ scored: number; failed: number; total: number }> {
  const { data: opps, error } = await supabase
    .from('gov_opportunities')
    .select('*')
    .eq('status', 'new')
    .limit(50);

  if (error) throw error;
  if (!opps?.length) { console.log('No new opportunities to score.'); return { scored: 0, failed: 0, total: 0 }; }

  let scored = 0;
  let failed = 0;
  const providerHits: Record<string, number> = {};

  for (const opp of opps) {
    const prompt = `
You are a government contracting analyst for AuthiChain.

Company profile:
${AUTHICHAIN_PROFILE}

Evaluate this opportunity and respond with JSON only:
{
  "fit_score": <0-100>,
  "reasoning": "<2 sentences>",
  "key_requirements": ["<req1>", "<req2>"],
  "recommended_action": "pursue" | "monitor" | "skip"
}

Opportunity:
Title: ${opp.title}
Agency: ${opp.agency}
NAICS: ${opp.naics_code}
Deadline: ${opp.deadline}
Description: ${(opp.description ?? '').slice(0, 2000)}
`;

    try {
      const { content, provider } = await chat({
        messages: [{ role: 'user', content: prompt }],
        jsonMode: true,
        temperature: 0.2,
        openaiModel: 'gpt-4o-mini',
      });
      providerHits[provider] = (providerHits[provider] ?? 0) + 1;

      const result = JSON.parse(content || '{}');

      if (!isDryRun) {
        await supabase
          .from('gov_opportunities')
          .update({
            fit_score:            result.fit_score,
            ai_reasoning:         result.reasoning,
            key_requirements:     result.key_requirements,
            recommended_action:   result.recommended_action,
            status:               result.recommended_action === 'skip' ? 'skipped' : 'scored',
            scored_at:            new Date().toISOString(),
            govchain_detail_url:  `${GOVCHAIN}/opportunities/${opp.notice_id}`,
          })
          .eq('notice_id', opp.notice_id);
      }

      console.log(`  [${result.fit_score}/100] ${opp.title?.slice(0, 60)} → ${result.recommended_action}`);
      scored++;
    } catch (err: any) {
      // Per-opportunity failure: log and continue so one bad call doesn't kill
      // the whole batch. Opp stays at status='new' so it gets retried next run.
      failed++;
      const shortMsg = (err?.message || String(err)).split('\n')[0].slice(0, 200);
      console.warn(`  ⚠️  skipped ${opp.notice_id} (${opp.title?.slice(0, 40)}): ${shortMsg}`);
    }
  }

  const breakdown = Object.entries(providerHits)
    .map(([p, n]) => `${p}=${n}`)
    .join(', ');
  console.log(`🔌 LLM providers used: ${breakdown || 'none'}`);

  return { scored, failed, total: opps.length };
}

const { scored, failed, total } = await scoreOpportunities();
console.log(`✅ Scored ${scored}/${total} opportunities (${failed} failed)`);

// Only fail the job if we had opportunities to score but scored exactly zero.
// Otherwise, partial success is still success — failed opps stay at status='new'
// and will be retried on the next cron run.
if (total > 0 && scored === 0) {
  console.error('❌ All scoring attempts failed — see provider errors above.');
  process.exit(1);
}
process.exit(0);
