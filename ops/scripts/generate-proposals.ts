// scripts/generate-proposals.ts
import { createClient } from '@supabase/supabase-js';
import { chat } from './lib/llm.ts';

const isDryRun = process.env.DRY_RUN === 'true';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const GOVCHAIN = process.env.GOVCHAIN_URL ?? 'https://govchain.us';

async function generateProposals(): Promise<{ generated: number; failed: number; total: number }> {
  const { data: opps, error } = await supabase
    .from('gov_opportunities')
    .select('*')
    .eq('status', 'scored')
    .gte('fit_score', 65)
    .order('fit_score', { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!opps?.length) { console.log('No high-fit opportunities for proposal generation.'); return { generated: 0, failed: 0, total: 0 }; }

  let generated = 0;
  let failed = 0;
  const providerHits: Record<string, number> = {};

  for (const opp of opps) {
    const prompt = `
You are a government proposal writer for AuthiChain, a blockchain authentication company.

Write a concise capability statement (400 words max) for this opportunity.
Structure: Executive Summary → Technical Approach → Differentiators → Past Performance → Call to Action.
Reference GovChain (${GOVCHAIN}) as the government-specific portal.
Use formal government contracting language.

Opportunity:
Title: ${opp.title}
Agency: ${opp.agency}
Key Requirements: ${JSON.stringify(opp.key_requirements)}
AI Reasoning: ${opp.ai_reasoning}
`;

    try {
      const { content, provider } = await chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 800,
        openaiModel: 'gpt-4o',
      });
      providerHits[provider] = (providerHits[provider] ?? 0) + 1;

      const proposal_draft = content;

      if (!isDryRun) {
        await supabase.from('gov_proposals').upsert({
          notice_id:      opp.notice_id,
          title:          opp.title,
          agency:         opp.agency,
          fit_score:      opp.fit_score,
          proposal_draft,
          govchain_url:   `${GOVCHAIN}/proposals/${opp.notice_id}`,
          sam_url:        opp.sam_url,
          deadline:       opp.deadline,
          generated_at:   new Date().toISOString(),
          status:         'draft',
        });

        await supabase
          .from('gov_opportunities')
          .update({ status: 'proposal_drafted' })
          .eq('notice_id', opp.notice_id);
      }

      console.log(`  📝 Draft generated: ${opp.title?.slice(0, 60)}`);
      generated++;
    } catch (err: any) {
      // Per-opportunity failure: log and continue. Opp stays at status='scored'
      // so it's picked up again on the next cron run.
      failed++;
      const fullMsg = (err?.message || String(err)).slice(0, 600);
      console.warn(`  ⚠️  skipped ${opp.notice_id} (${opp.title?.slice(0, 40)}): ${fullMsg}`);
    }
  }

  const breakdown = Object.entries(providerHits)
    .map(([p, n]) => `${p}=${n}`)
    .join(', ');
  console.log(`🔌 LLM providers used: ${breakdown || 'none'}`);

  return { generated, failed, total: opps.length };
}

const { generated, failed, total } = await generateProposals();
console.log(`✅ Generated ${generated}/${total} proposal drafts (${failed} failed)`);

// Only fail the job if we had work to do but accomplished none of it.
if (total > 0 && generated === 0) {
  console.error('❌ All proposal generation attempts failed — see provider errors above.');
  process.exit(1);
}
process.exit(0);
