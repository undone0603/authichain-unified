// scripts/qualify-leads.ts
// Converts high-fit opportunities (fit_score >= 70) into qualified leads.
// Generates lead_score_detail with blockchain/sector/budget/timeline breakdown.
// Creates leads table entries for downstream email-proposals pipeline.

import { createClient } from '@supabase/supabase-js';
import { chat } from './lib/llm.ts';

const isDryRun = process.env.DRY_RUN === 'true';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const FIT_THRESHOLD = 70; // Only qualify high-fit opportunities

interface LeadScoreDetail {
  blockchain_fit: {
    score: number;
    rationale: string;
  };
  agency_sector_match: {
    score: number;
    rationale: string;
  };
  budget_alignment: {
    score: number;
    rationale: string;
  };
  timeline_fit: {
    score: number;
    rationale: string;
  };
}

async function generateLeadScoreDetail(opp: any): Promise<LeadScoreDetail> {
  const prompt = `
You are a government contracting analyst for AuthiChain.

Opportunity:
Title: ${opp.title}
Agency: ${opp.agency}
Description: ${(opp.description ?? '').slice(0, 2000)}
Key Requirements: ${JSON.stringify(opp.key_requirements)}
AI Reasoning: ${opp.ai_reasoning}

Generate a detailed lead scoring breakdown (JSON only) with four dimensions (each 0-100):
{
  "blockchain_fit": {
    "score": <0-100>,
    "rationale": "<1-2 sentences on blockchain authentication/provenance alignment>"
  },
  "agency_sector_match": {
    "score": <0-100>,
    "rationale": "<1-2 sentences on agency mission/sector fit>"
  },
  "budget_alignment": {
    "score": <0-100>,
    "rationale": "<1-2 sentences on contract value readiness>"
  },
  "timeline_fit": {
    "score": <0-100>,
    "rationale": "<1-2 sentences on execution timeline feasibility>"
  }
}
`;

  try {
    const { content, provider } = await chat({
      messages: [{ role: 'user', content: prompt }],
      jsonMode: true,
      temperature: 0.2,
      openaiModel: 'gpt-4o-mini',
    });

    const detail = JSON.parse(content || '{}') as LeadScoreDetail;
    return detail;
  } catch (err: any) {
    console.warn(`  ⚠️  Failed to generate lead score detail for ${opp.notice_id}: ${err.message}`);
    // Return safe defaults on LLM failure
    return {
      blockchain_fit: { score: opp.fit_score, rationale: 'Generated from opportunity fit_score' },
      agency_sector_match: { score: opp.fit_score, rationale: 'Generated from opportunity fit_score' },
      budget_alignment: { score: opp.fit_score, rationale: 'Generated from opportunity fit_score' },
      timeline_fit: { score: opp.fit_score, rationale: 'Generated from opportunity fit_score' },
    };
  }
}

async function qualifyLeads(): Promise<{ qualified: number; failed: number; total: number }> {
  // Fetch all opportunities with fit_score >= threshold and status='scored'
  const { data: opps, error } = await supabase
    .from('gov_opportunities')
    .select('*')
    .eq('status', 'scored')
    .gte('fit_score', FIT_THRESHOLD)
    .order('fit_score', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!opps?.length) {
    console.log(`No opportunities with fit_score >= ${FIT_THRESHOLD} to qualify.`);
    return { qualified: 0, failed: 0, total: 0 };
  }

  let qualified = 0;
  let failed = 0;

  for (const opp of opps) {
    try {
      // Generate detailed lead score breakdown
      const lead_score_detail = await generateLeadScoreDetail(opp);

      // Extract agency name as lead name (try to parse contact info from description)
      const agency_name = opp.agency || 'Unknown Agency';

      if (!isDryRun) {
        // Upsert into leads table with gov_engine specific fields
        const { error: insertError } = await supabase.from('leads').upsert(
          {
            email: `procurement@${agency_name.toLowerCase().replace(/\s+/g, '-')}.gov`,
            name: agency_name,
            company: opp.agency,
            source: 'gov_engine',
            score: opp.fit_score,
            leadScore: opp.fit_score,
            status: 'qualified',
            industry: opp.naics_code || 'Government',
            metadata: {
              opportunity_id: opp.notice_id,
              fit_score: opp.fit_score,
              key_requirements: opp.key_requirements,
              ai_reasoning: opp.ai_reasoning,
              lead_score_detail,
              govchain_url: opp.govchain_detail_url,
              sam_url: opp.sam_url,
              deadline: opp.deadline,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );

        if (insertError) {
          console.warn(`  ⚠️  Failed to create lead for ${opp.notice_id}: ${insertError.message}`);
          failed++;
          continue;
        }

        // Mark opportunity as qualified
        const { error: updateError } = await supabase
          .from('gov_opportunities')
          .update({
            status: 'qualified',
            scored_at: new Date().toISOString(),
          })
          .eq('notice_id', opp.notice_id);

        if (updateError) {
          console.warn(`  ⚠️  Failed to update opportunity ${opp.notice_id}: ${updateError.message}`);
          failed++;
          continue;
        }
      }

      console.log(`  ✅ Qualified: ${opp.title?.slice(0, 60)} (${opp.fit_score}/100)`);
      qualified++;
    } catch (err: any) {
      failed++;
      const shortMsg = (err?.message || String(err)).split('\n')[0].slice(0, 200);
      console.warn(`  ⚠️  skipped ${opp.notice_id}: ${shortMsg}`);
    }
  }

  return { qualified, failed, total: opps.length };
}

const { qualified, failed, total } = await qualifyLeads();
console.log(`✅ Qualified ${qualified}/${total} leads (${failed} failed)`);

// Only fail if we had opportunities but qualified exactly zero
if (total > 0 && qualified === 0) {
  console.error('❌ All lead qualification attempts failed — see errors above.');
  process.exit(1);
}
process.exit(0);
