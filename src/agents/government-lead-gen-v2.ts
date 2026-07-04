// src/agents/government-lead-gen-v2.ts
// v2.5 — FULL FEDERAL INTEGRATION
//   • SAM.gov Opportunities v2 (real)
//   • SAM.gov Contract Awards v1 (real, FPDS replacement)
//   • USAspending v2 (real, public, no key)
//   • Supabase pgvector semantic match (replaces Pinecone)
//   • 5-agent consensus / QRON / outreach / on-chain mint  (STUBBED behind DRY_RUN)
//
// DRY_RUN behavior:
//   process.env.DRY_RUN !== 'false'  →  no emails sent, no NFTs minted, no chain writes
//   process.env.DRY_RUN === 'false'  →  performs real outreach + minting (requires real impls wired in)

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../lib/email';

// ──────────────────────────────────────────────────────────────────────────────
// Active entity (the GovChain.us pilot signer)
// ──────────────────────────────────────────────────────────────────────────────
const ACTIVE_ENTITY = {
  name: 'GovChain',
  domain: 'govchain.us',
  wallet: '0xC0D26735fd9e868eacc60400ef3171Fa4161177f',
  mission:
    'Government Document & Product Verification — American-built infrastructure for procurement transparency and lives saved globally.',
} as const;

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default TRUE for safety

// ──────────────────────────────────────────────────────────────────────────────
// Supabase pgvector semantic search — embeddings via HuggingFace (free)
// Model: BAAI/bge-small-en-v1.5 (384 dims)
// ──────────────────────────────────────────────────────────────────────────────
const HF_EMBED_URL = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5';

async function embedText(text: string): Promise<number[] | null> {
  const token = process.env.HF_TOKEN_PRIMARY;
  if (!token) return null;
  try {
    const res = await fetch(HF_EMBED_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text.slice(0, 2000), options: { wait_for_model: true } }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return Array.isArray(data[0]) ? data[0] : data;
  } catch { return null; }
}

async function findSupabaseOpportunities(queryText: string, limit = 8): Promise<any[]> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[gov-engine] Supabase env not set — skipping vector match');
    return [];
  }
  try {
    const embedding = await embedText(queryText);
    if (!embedding) {
      console.warn('[gov-engine] HF embedding failed — skipping vector match');
      return [];
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.rpc('match_gov_opportunities', {
      query_embedding: embedding,
      match_count: limit,
      min_score: 0.5,
    });
    if (error) { console.warn('[gov-engine] pgvector RPC error:', error.message); return []; }
    return (data ?? []).map((r: any) => ({
      ...r,
      id: r.notice_id,
      relevanceScore: Math.round((r.similarity ?? 0.5) * 100),
      source: 'supabase-pgvector',
    }));
  } catch (err) {
    console.warn('[gov-engine] vector match skipped:', (err as Error).message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Date helpers — SAM.gov v2 wants MM/dd/yyyy, USAspending wants YYYY-MM-DD
// ──────────────────────────────────────────────────────────────────────────────
function rollingWindow(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sam = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { samFrom: sam(from), samTo: sam(to), isoFrom: iso(from), isoTo: iso(to) };
}

// ──────────────────────────────────────────────────────────────────────────────
// SAM.gov Opportunities v2  (real endpoint)
// ──────────────────────────────────────────────────────────────────────────────
async function fetchSAMOpportunities(): Promise<any[]> {
  const key = process.env.SAM_GOV_API_KEY;
  if (!key) {
    console.warn('[gov-engine] SAM_GOV_API_KEY not set — skipping Opportunities');
    return [];
  }
  const { samFrom, samTo } = rollingWindow(30);
  const q = encodeURIComponent(
    'counterfeit prevention OR Buy American OR traceability OR document authentication OR supply chain verification'
  );
  const url =
    `https://api.sam.gov/opportunities/v2/search` +
    `?api_key=${key}&q=${q}&limit=15` +
    `&postedFrom=${encodeURIComponent(samFrom)}&postedTo=${encodeURIComponent(samTo)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[gov-engine] SAM Opportunities ${res.status} ${res.statusText}`);
      return [];
    }
    const data: any = await res.json();
    return data.opportunitiesData || [];
  } catch (err) {
    console.error('[gov-engine] fetchSAMOpportunities failed:', err);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SAM.gov Contract Awards v1  (real, official FPDS replacement)
// ──────────────────────────────────────────────────────────────────────────────
async function fetchSAMContractAwards(): Promise<any[]> {
  const key = process.env.SAM_GOV_API_KEY;
  if (!key) {
    console.warn('[gov-engine] SAM_GOV_API_KEY not set — skipping Contract Awards');
    return [];
  }
  const { samFrom, samTo } = rollingWindow(120);
  const q = encodeURIComponent('counterfeit prevention OR Buy American OR traceability');
  const url =
    `https://api.sam.gov/contract-awards/v1/search` +
    `?api_key=${key}&q=${q}&limit=15` +
    `&modifiedFrom=${encodeURIComponent(samFrom)}&modifiedTo=${encodeURIComponent(samTo)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[gov-engine] SAM Contract Awards ${res.status} ${res.statusText}`);
      return [];
    }
    const data: any = await res.json();
    return data.results || data.contractAwardsData || [];
  } catch (err) {
    console.error('[gov-engine] fetchSAMContractAwards failed:', err);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// USAspending v2  (public, no key required)
// ──────────────────────────────────────────────────────────────────────────────
async function fetchUSASpendingAwards(agencyName?: string): Promise<any[]> {
  const { isoFrom, isoTo } = rollingWindow(120);
  const body: any = {
    filters: {
      award_type_codes: ['A', 'B', 'C', 'D'],
      time_period: [{ start_date: isoFrom, end_date: isoTo }],
    },
    fields: ['Award ID', 'Recipient Name', 'Awarding Agency', 'Award Amount', 'Award Date'],
    limit: 8,
    sort: 'Award Date',
    order: 'desc',
  };
  if (agencyName) {
    body.filters.agencies = [{ type: 'awarding', tier: 'toptier', name: agencyName }];
  }
  try {
    const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('[gov-engine] fetchUSASpendingAwards failed:', err);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// STUBS for not-yet-built modules. Replace with real impls when ready.
// All side-effecting stubs respect DRY_RUN.
// ──────────────────────────────────────────────────────────────────────────────
type ConsensusResult = { approved: boolean; score: number; rationale: string };

// TODO(real-impl): wire to your 5-agent (Guardian, Archivist, Sentinel, Scout, Arbiter) module.
async function runFiveAgentConsensus(lead: any): Promise<ConsensusResult> {
  // Lightweight heuristic so the pipeline runs end-to-end before the real agents land.
  const haystack = JSON.stringify(lead).toLowerCase();
  const hits = ['counterfeit', 'buy american', 'traceability', 'authentication', 'verification']
    .filter(k => haystack.includes(k)).length;
  const score = Math.min(100, 50 + hits * 12);
  return { approved: score >= 60, score, rationale: `heuristic-stub: ${hits} keyword hits` };
}

type QRON = { signature: string; payload: any; style: string };

async function generateQRON(payload: any): Promise<QRON> {
  try {
    const res = await fetch('https://qron-image-gen.undone-k.workers.dev/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `US government seal, blockchain supply chain verification, ${payload.agency || 'federal agency'}, GovChain authentication mark`,
        style: 'marble_white',
        width: 512,
        height: 512,
      }),
    });
    if (res.ok) {
      const data: any = await res.json();
      const imageUrl: string = data.imageUrl || data.url || '';
      if (imageUrl) return { signature: imageUrl, payload, style: 'marble_white' };
    }
  } catch { /* fall through to stub */ }
  const sig = 'qron-' + Buffer.from(JSON.stringify(payload)).toString('base64').slice(0, 24);
  return { signature: sig, payload, style: 'american-seal-eagle-govchain' };
}

async function sendOutreach(lead: any, proposal: string, qron: QRON): Promise<void> {
  if (DRY_RUN) {
    console.log(`[gov-engine] DRY_RUN outreach skipped for ${lead.agency || 'lead'}`);
    return;
  }
  // Extract contact email from raw SAM.gov data (pointOfContact array)
  const poc = lead.raw?.pointOfContact?.[0] ?? lead.raw?.poc?.[0];
  const contactEmail: string | undefined = poc?.email || lead.raw?.email;
  if (!contactEmail) {
    console.log(`[gov-engine] No contact email for ${lead.agency} — outreach skipped`);
    return;
  }
  const result = await sendEmail({
    from: 'GovChain <ops@authichain.com>',
    to: contactEmail,
    subject: `GovChain.us — Blockchain Traceability Pilot for ${lead.agency}`,
    text: proposal,
    html: proposal.replace(/\n/g, '<br>'),
  });
  console.log(`[gov-engine] Outreach ${result.ok ? 'sent' : 'failed'} to ${contactEmail} via ${result.provider}`);
}

// TODO(real-impl): wire to thirdweb / ethers polygon contract when deployed.
async function mintPilotNFT(args: {
  leadId: string;
  agency: string;
  qronSignature: string;
  consensusScore: number;
}): Promise<void> {
  if (DRY_RUN) {
    console.log(
      `[gov-engine] DRY_RUN mint skipped — would mint pilot NFT for ${args.agency} (lead ${args.leadId}, score ${args.consensusScore}, sig ${args.qronSignature})`
    );
    return;
  }
  throw new Error('Real on-chain mint not yet wired. Set DRY_RUN=true or implement mintPilotNFT().');
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers to normalize lead shapes across the three federal sources
// ──────────────────────────────────────────────────────────────────────────────
function normalizeLead(raw: any, source: string) {
  return {
    id:
      raw.id ||
      raw.noticeId ||
      raw.opportunity_id ||
      raw.piid ||
      raw.contractAwardId ||
      `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: raw.title || raw.contractDescription || '',
    agency:
      raw.agency ||
      raw.contractingAgency ||
      raw.awardingAgencyName ||
      raw.organizationType ||
      'Federal Agency',
    contact: raw.contact || raw.pointOfContact?.[0]?.fullName || 'Procurement Team',
    source,
    raw,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main entry — runs the autonomous federal lead-gen pipeline
// ──────────────────────────────────────────────────────────────────────────────
export async function runAdvancedGovernmentLeadGen() {
  console.log(
    `🚀 GovChain autonomous lead-gen v2.5 starting (DRY_RUN=${DRY_RUN}) — SAM Opps + Contract Awards v1 + USAspending + pgvector`
  );

  // 1. Pull federal data sources in parallel
  const [opportunities, awards] = await Promise.all([
    fetchSAMOpportunities(),
    fetchSAMContractAwards(),
  ]);
  console.log(
    `[gov-engine] SAM.gov: ${opportunities.length} opportunities, ${awards.length} contract awards`
  );

  // 2. Enrich opportunities with USAspending + matched contract awards
  const enrichedLeads: any[] = [];
  for (const opp of opportunities) {
    const lead = normalizeLead(opp, 'sam.gov-opportunity');
    const spending = await fetchUSASpendingAwards(lead.agency);
    enrichedLeads.push({
      ...lead,
      awardsContext: awards
        .filter((a: any) => (a.awardingAgencyName || a.agency) === lead.agency)
        .slice(0, 3),
      spendingContext: spending[0] || null,
      relevanceScore: spending.length > 0 ? 90 : 70,
    });
  }

  // 3. Add raw contract awards as their own leads
  for (const award of awards) {
    enrichedLeads.push({
      ...normalizeLead(award, 'sam.gov-contract-awards'),
      awardsContext: [award],
      relevanceScore: 85,
    });
  }

  // 4. Pull semantic matches from Supabase pgvector
  const queryText = [
    ACTIVE_ENTITY.name, ACTIVE_ENTITY.mission,
    'document authentication product verification QR traceability on-chain provenance Buy American compliance',
    'NAICS 541611 541512 541519',
  ].join(' ');
  const vectorLeads = await findSupabaseOpportunities(queryText, 8);

  const allLeads = [
    ...enrichedLeads,
    ...vectorLeads.map((v: any) => normalizeLead(v, 'supabase-pgvector')),
  ];

  // 5. Process each lead through consensus → QRON → outreach → mint
  let processed = 0;
  for (const lead of allLeads) {
    const consensus = await runFiveAgentConsensus(lead);
    console.log(`[gov-engine] Found: ${lead.title} (${lead.agency})`);
    if (!consensus.approved) {
      console.log(`[gov-engine] ⏭  skipped ${lead.agency} (score ${consensus.score})`);
      continue;
    }

    const qron = await generateQRON({
      leadId: lead.id,
      entity: ACTIVE_ENTITY.name,
      agency: lead.agency,
    });

    const proposal = [
      `Subject: GovChain.us — Instant Verification Pilot for ${lead.agency}`,
      ``,
      `Hi ${lead.contact},`,
      ``,
      `GovChain (powered by AuthiChain) delivers:`,
      `  • 2.1-second AI AutoFlow™ + TrueMark™ seals`,
      `  • Live SAM.gov data (Opportunities + Contract Awards v1 / FPDS replacement)`,
      `  • Buy American / DFARS / DHS SVIP ready`,
      `  • Transparent pilot NFT from active signer ${ACTIVE_ENTITY.wallet}`,
      ``,
      `One-click pilot: https://govchain.us/verify?id=GC-PILOT-${Date.now()}`,
      `Saving lives globally. Securing U.S. government supply chains.`,
      `— Zachary Kietzman, Founder (@Undone0603)`,
    ].join('\n');

    await sendOutreach(lead, proposal, qron);

    await mintPilotNFT({
      leadId: lead.id,
      agency: lead.agency,
      qronSignature: qron.signature,
      consensusScore: consensus.score,
    });

    processed++;
    console.log(
      `✅ Processed ${lead.agency} — consensus ${consensus.score}, qron ${qron.signature}`
    );
  }

  console.log(
    `🎯 ${processed}/${allLeads.length} federal leads processed (DRY_RUN=${DRY_RUN}, signer=${ACTIVE_ENTITY.wallet})`
  );
  return { total: allLeads.length, processed, dryRun: DRY_RUN };
}

export async function startGovernmentEngine() {
  const result = await runAdvancedGovernmentLeadGen();
  console.log(`🔄 GovChain engine run complete (DRY_RUN=${DRY_RUN})`);
  return result;
}
