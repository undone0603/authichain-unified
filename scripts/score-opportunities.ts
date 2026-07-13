// scripts/score-opportunities.ts
import { createClient } from '@supabase/supabase-js';
import { chat } from './lib/llm.ts';

// Scoring reads opportunities exclusively from Supabase (the source of truth);
// it never queries Pinecone. The previous `new Pinecone(...)` client was unused
// dead code and its static import aborted this job with ERR_MODULE_NOT_FOUND
// when @pinecone-database/pinecone wasn't installed — removed.
const isDryRun  = process.env.DRY_RUN === 'true';
const supabase  = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const GOVCHAIN  = process.env.GOVCHAIN_URL ?? 'https://govchain.us';

const AUTHICHAIN_PROFILE = `
AuthiChain is a blockchain-powered product authentication and compliance platform.
Products:
- GovChain (govchain.us): Federal opportunity pipeline, CMMC supply-chain traceability,
  blockchain-anchored past-performance proof, automated RFP proposals.
- AuthiChain (authichain.com): Enterprise product authentication, NFT certificates,
  AI counterfeit detection, EU Digital Product Passport (DPP) compliance.
- StrainChain (strainchain.io): Cannabis seed-to-sale blockchain provenance, METRC integration,
  EU DPP-compliant COA hashing.
- QRON (qron.space): AI-generated signed QR codes for brand packaging and labeling.

Target agencies: DoD, DHS, FDA, USDA, CBP, GSA, NIST, CISA, Army, Navy, Air Force.
NAICS: 541511, 541512, 541519, 334111, 336413, 332710, 339999.

Strengths:
- CMMC 2.0 Level 2/3 supply-chain traceability (hard deadline: Nov 10, 2026)
- FedRAMP-ready blockchain audit trail (hard deadline: Jan 1, 2027 CR26)
- EU Digital Product Passport (DPP) compliance for battery/textile manufacturers
- Anti-counterfeiting with cryptographic Ed25519 seals
- Zero-trust verification, IoT-linked authentication
- Immutable audit ledger for contracting officer scrutiny

CMMC KEYWORDS (high-fit signal): CMMC, CUI, FCI, supply chain risk, DFARS 252.204-7012,
NIST 800-171, zero trust, provenance, chain of custody, counterfeit parts,
counterfeit detection, SCRM, ITAR, FedRAMP, ATO, cybersecurity maturity.
`;

const FIT_THRESHOLD_HIGH = 70;  // Only pursue high-fit opportunities
const FIT_THRESHOLD_BORDERLINE = 60; // Manual review queue threshold

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
    // Boost CMMC/FedRAMP/supply-chain urgency keywords for Nov 2026 deadline
    const cmmcKeywords = ['cmmc', 'cui', 'fci', 'dfars', 'nist 800-171', 'supply chain risk',
      'scrm', 'zero trust', 'itar', 'fedramp', 'ato', 'provenance', 'counterfeit',
      'chain of custody', 'cybersecurity maturity'];
    const descLower = (opp.description ?? '').toLowerCase();
    const titleLower = (opp.title ?? '').toLowerCase();
    const hasCmmcSignal = cmmcKeywords.some(kw => descLower.includes(kw) || titleLower.includes(kw));
    const cmmcBoostNote = hasCmmcSignal
      ? '\n⚡ CMMC/FedRAMP/supply-chain keywords detected — apply +10 urgency boost to fit_score.'
      : '';

    const prompt = `
You are a government contracting analyst for AuthiChain.

Company profile:
${AUTHICHAIN_PROFILE}
${cmmcBoostNote}

Evaluate this opportunity and respond with JSON only:
{
  "fit_score": <0-100>,
  "reasoning": "<2 sentences>",
  "key_requirements": ["<req1>", "<req2>"],
  "recommended_action": "pursue" | "monitor" | "skip",
  "cmmc_urgent": <true|false>
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

      // Determine recommended action based on fit_score thresholds.
      // Every branch below assigns finalAction, so no initial value is needed.
      let finalAction: string;
      if (result.fit_score >= FIT_THRESHOLD_HIGH) {
        finalAction = 'pursue';
      } else if (result.fit_score >= FIT_THRESHOLD_BORDERLINE) {
        finalAction = 'qualify'; // Borderline — manual review queue
      } else {
        finalAction = 'skip';
      }

      const newStatus = finalAction === 'skip' ? 'skipped' : 'scored';

      if (!isDryRun) {
        await supabase
          .from('gov_opportunities')
          .update({
            fit_score:            result.fit_score,
            ai_reasoning:         result.reasoning,
            key_requirements:     result.key_requirements,
            recommended_action:   finalAction,
            status:               newStatus,
            scored_at:            new Date().toISOString(),
            govchain_detail_url:  `${GOVCHAIN}/opportunities/${opp.notice_id}`,
          })
          .eq('notice_id', opp.notice_id);
      }

      console.log(`  [${result.fit_score}/100] ${opp.title?.slice(0, 60)} → ${finalAction}`);
      scored++;
    } catch (err: any) {
      // Per-opportunity failure: log and continue so one bad call doesn't kill
      // the whole batch. Opp stays at status='new' so it gets retried next run.
      failed++;
      const fullMsg = (err?.message || String(err)).slice(0, 600);
      console.warn(`  ⚠️  skipped ${opp.notice_id} (${opp.title?.slice(0, 40)}): ${fullMsg}`);
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
