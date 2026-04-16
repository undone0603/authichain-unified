// scripts/generate-proposals.ts
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const isDryRun = process.env.DRY_RUN === 'true';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const GOVCHAIN = process.env.GOVCHAIN_URL ?? 'https://govchain.us';

async function generateProposals() {
  const { data: opps, error } = await supabase
    .from('gov_opportunities')
    .select('*')
    .eq('status', 'scored')
    .gte('fit_score', 65)
    .order('fit_score', { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!opps?.length) { console.log('No high-fit opportunities for proposal generation.'); return 0; }

  let generated = 0;

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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 800,
    });

    const proposal_draft = completion.choices[0].message.content ?? '';

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
  }

  return generated;
}

const total = await generateProposals();
console.log(`✅ Generated ${total} proposal drafts`);
process.exit(0);
