// scripts/score-opportunities.ts
import { createClient } from '@supabase/supabase-js';
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

async function scoreOpportunities() {
  const { data: opps, error } = await supabase
    .from('gov_opportunities')
    .select('*')
    .eq('status', 'new')
    .limit(50);

  if (error) throw error;
  if (!opps?.length) { console.log('No new opportunities to score.'); return 0; }

  let scored = 0;
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
  }

  const breakdown = Object.entries(providerHits)
    .map(([p, n]) => `${p}=${n}`)
    .join(', ');
  console.log(`🔌 LLM providers used: ${breakdown || 'none'}`);

  return scored;
}

const total = await scoreOpportunities();
console.log(`✅ Scored ${total} opportunities`);
process.exit(0);
