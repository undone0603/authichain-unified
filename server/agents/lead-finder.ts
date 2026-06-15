import { invokeLLM, parseLLMContent } from '../_core/llm';
import { logActivity, enqueueTask, getAdaptivePriors, getDb } from '../db';
import type { MissionTask as Task } from '../../drizzle/schema';
import { leads } from '../../drizzle/schema';
import { SEGMENT_REVENUE, betaMean, betaCI } from '../_core/bayesian';
import { apolloSearchLeads, type ApolloLead } from '../apollo-service';
import { invokeLLM as _llm } from '../_core/llm';

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
  const KIND_TO_SEGMENT: Record<string, string> = {
    FIND_GOV_LEADS:          'GOV',
    FIND_RETAIL_LEADS:       'RETAIL',
    FIND_LUXURY_LEADS:       'LUXURY',
    FIND_PHARMA_LEADS:       'PHARMA',
    FIND_TIMEPIECE_LEADS:    'TIMEPIECE',
    FIND_ENTERTAINMENT_LEADS:'ENTERTAINMENT',
    FIND_SPORTS_LEADS:       'SPORTS',
    FIND_CREATOR_LEADS:      'CREATOR',
    FIND_COLLECTIBLES_LEADS: 'COLLECTIBLES',
  };
  const segment = payload.segment ?? KIND_TO_SEGMENT[task.kind] ?? 'RETAIL';

  const count = payload.count ?? 10;
  const ICP_MAP: Record<string, string> = {
    GOV:           'government agency procurement and supply chain officer',
    LUXURY:        'Head of Brand Protection at luxury fashion house',
    PHARMA:        'Chief Compliance Officer at pharmaceutical manufacturer',
    TIMEPIECE:     'CEO or Founder of independent luxury watch brand',
    ENTERTAINMENT: 'VP of Merchandise or Director of Licensing at a music label, film studio, or live events company',
    SPORTS:        'VP of Licensing or Director of Memorabilia Authentication at a professional sports team or league',
    CREATOR:       'Founder or Head of Brand at a creator-economy company with a physical merchandise line',
    COLLECTIBLES:  'CEO or Head of Authentication at a collectibles marketplace or grading company',
  };
  const icp = payload.icp ?? ICP_MAP[segment] ?? 'retail cannabis dispensary owner or manager';

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

<<<<<<< HEAD
    const MOONSHOT_SEGMENTS = new Set(['ENTERTAINMENT', 'SPORTS', 'CREATOR', 'COLLECTIBLES']);
    const taskKind = MOONSHOT_SEGMENTS.has(segment) ? 'PITCH_MOONSHOT_DEAL' : 'DRAFT_OUTBOUND_EMAIL';
    await enqueueTask(task.missionId, taskKind, {
=======
    // Research the lead's website before drafting the email so the browser
    // agent can inject a personalised hook into the outbound copy.
    await enqueueTask(task.missionId, 'BROWSE_RESEARCH_LEAD', {
>>>>>>> origin/add-agentz-editable
      segment,
      leadEmail: lead.email,
      leadName:  lead.name,
      leadOrg:   lead.org,
      leadTitle: lead.title,
      domain:    lead.linkedinUrl ? undefined : undefined, // browser agent infers from org name
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
