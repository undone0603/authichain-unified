import { invokeLLM, parseLLMContent } from '../_core/llm.js';
import { logActivity, enqueueTask, getAdaptivePriors, getDb } from '../db.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';
import { leads } from '../../drizzle/schema.js';
import { SEGMENT_REVENUE, betaMean, betaCI } from '../_core/bayesian.js';
import { apolloSearchLeads, type ApolloLead } from '../apollo-service.js';
import { invokeLLM as _llm } from '../_core/llm.js';

interface LeadFinderPayload {
  count?: number;
  icp?: string;
  vertical?: string;
  segment?: string;
}

interface ScoredLead extends ApolloLead {
  fitProbability: number;
  fitNotes: string;
}

/** Score Apollo leads via LLM Bayesian reasoning — one LLM call for the whole batch. */
async function scoreleads(
  apolloLeads: ApolloLead[],
  segment: string,
  icp: string,
  conversionMean: number,
  ciLo: number,
  ciHi: number,
  expectedValue: string,
): Promise<ScoredLead[]> {
  if (apolloLeads.length === 0) return [];

  const leadList = apolloLeads.map((l, i) =>
    `${i}: name="${l.name}" title="${l.title}" org="${l.org}" industry="${l.orgIndustry ?? ''}" seniority="${l.seniority ?? ''}"`,
  ).join('\n');

  const prompt = `[BAYESIAN REASONING]
Prior: ${segment} conversion rate ≈ ${(conversionMean * 100).toFixed(1)}% (95% CI: ${(ciLo * 100).toFixed(1)}%–${(ciHi * 100).toFixed(1)}%).
Expected value per converted lead: ~$${expectedValue}.
[END REASONING]

ICP: ${icp}
Segment: ${segment}

Score each lead's fit for AuthiChain's blockchain product authentication platform.
AuthiChain's strongest value props: supply chain integrity, anti-counterfeit via QR+AI, NFT provenance.

Leads:
${leadList}

Return JSON array (same order, same indices):
[{ "index": 0, "fitProbability": 0.0–1.0, "fitNotes": "one sentence reason" }, ...]`;

  try {
    const result = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
    });
    const parsed = parseLLMContent<any>(result.choices[0].message.content);
    const scores: Array<{ index: number; fitProbability: number; fitNotes: string }> =
      Array.isArray(parsed) ? parsed : (parsed.leads ?? parsed.scores ?? []);

    return apolloLeads.map((lead, i) => {
      const score = scores.find(s => s.index === i);
      return {
        ...lead,
        fitProbability: score?.fitProbability ?? 0.5,
        fitNotes: score?.fitNotes ?? '',
      };
    });
  } catch {
    // Fallback: assign neutral score without crashing
    return apolloLeads.map(l => ({ ...l, fitProbability: 0.5, fitNotes: 'unscored' }));
  }
}

export async function runLeadFinder(task: Task): Promise<void> {
  const payload = task.payload as LeadFinderPayload;
  const segment = payload.segment ?? 
    (task.kind === 'FIND_GOV_LEADS' ? 'GOV' : 
     task.kind === 'FIND_LUXURY_LEADS' ? 'LUXURY' :
     task.kind === 'FIND_PHARMA_LEADS' ? 'PHARMA' : 
     task.kind === 'FIND_TIMEPIECE_LEADS' ? 'TIMEPIECE' : 'RETAIL');
  
  const count = payload.count ?? 10;
  const icp = payload.icp ?? (
    segment === 'GOV' ? 'government agency procurement and supply chain officer' :
    segment === 'LUXURY' ? 'Head of Brand Protection at luxury fashion house' :
    segment === 'PHARMA' ? 'Chief Compliance Officer at pharmaceutical manufacturer' :
    segment === 'TIMEPIECE' ? 'CEO or Founder of independent luxury watch brand' :
    'retail cannabis dispensary owner or manager'
  );

  // ── Bayesian context ───────────────────────────────────────────────────────
  const adaptivePriors = await getAdaptivePriors();
  const prior = adaptivePriors[segment] ?? adaptivePriors.DEFAULT;
  const conversionMean = betaMean(prior);
  const [ciLo, ciHi] = betaCI(prior);
  const expectedRevenue = SEGMENT_REVENUE[segment] ?? SEGMENT_REVENUE.DEFAULT;
  const expectedValue = (conversionMean * expectedRevenue).toFixed(0);

  // ── Apollo lead discovery ─────────────────────────────────────────────────
  const apolloLeads = await apolloSearchLeads(segment, count);

  // ── LLM Bayesian scoring ──────────────────────────────────────────────────
  const scored = await scoreleads(apolloLeads, segment, icp, conversionMean, ciLo, ciHi, expectedValue);
  scored.sort((a, b) => b.fitProbability - a.fitProbability);
  const selected = scored.slice(0, count);

  // ── Insert + enqueue ───────────────────────────────────────────────────────
  const db = await getDb();
  let inserted = 0;

  for (const lead of selected) {
    if (!lead.email || !lead.org) continue;

    if (db) {
      await db.insert(leads).values({
        email:   lead.email.toLowerCase(),
        name:    lead.name,
        company: lead.org,
        title:   lead.title,
        notes:   `[apollo][fit:${lead.fitProbability.toFixed(2)}] ${lead.fitNotes}`,
        source:  `agentz_apollo_${segment.toLowerCase()}`,
        status:  'new',
        segment,
      }).onConflictDoNothing();
    }

    await enqueueTask(task.missionId, 'DRAFT_OUTBOUND_EMAIL', {
      segment,
      sequence: 1,
      leadEmail:  lead.email,
      leadName:   lead.name,
      leadOrg:    lead.org,
      leadTitle:  lead.title,
      linkedinUrl: lead.linkedinUrl,
    });

    inserted++;
  }

  await logActivity({
    userId: null, action: 'lead_finder_completed', entityType: 'task', entityId: 0,
    details: {
      taskId:   task.id,
      segment,
      source:   'apollo',
      found:    apolloLeads.length,
      scored:   scored.length,
      inserted,
      missionId: task.missionId,
    },
  });
}
