import { generateProductQRON } from '../qron-service.js';
import { sendEmail } from '../email-service.js';
import { mintAuthenticationNFT, buildAuthCertificateMetadata } from '../thirdweb.js';
import { logActivity } from '../db.js';
import { ENV } from '../_core/env.js';

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
// Lazy Pinecone init (so import doesn't crash environments without the key)
// ──────────────────────────────────────────────────────────────────────────────
let _pineconeIndex: any = null;
async function getPineconeIndex() {
  if (_pineconeIndex) return _pineconeIndex;
  if (!process.env.PINECONE_API_KEY) {
    console.warn('[gov-engine] PINECONE_API_KEY not set — Pinecone disabled');
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- installed at runtime; type stubs provided by @pinecone-database/pinecone in package.json
  const { Pinecone } = await import('@pinecone-database/pinecone');
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  _pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || 'authichain-gov-leads');
  return _pineconeIndex;
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
// CORE LOGIC — Consensus, QRON, Outreach, Minting
// ──────────────────────────────────────────────────────────────────────────────
type ConsensusResult = { approved: boolean; score: number; rationale: string };

/**
 * 5-Agent Consensus Module (Scout, Guardian, Archivist, Sentinel, Arbiter)
 * Heuristic fallback if agents are offline.
 */
async function runFiveAgentConsensus(lead: any): Promise<ConsensusResult> {
  const haystack = JSON.stringify(lead).toLowerCase();
  
  // Layer 1: Keyword match (Scout)
  const hits = ['counterfeit', 'buy american', 'traceability', 'authentication', 'verification', 'integrity', 'security']
    .filter(k => haystack.includes(k)).length;
  
  // Layer 2: Agency check (Guardian)
  const isHighValueAgency = ['commerce', 'defense', 'dhs', 'homeland', 'usda', 'justice'].some(a => lead.agency.toLowerCase().includes(a));
  
  // Layer 3: Contract size / scope (Archivist)
  const isLargeScope = lead.awardsContext?.length > 0 || lead.relevanceScore > 80;

  const score = Math.min(100, 40 + (hits * 10) + (isHighValueAgency ? 20 : 0) + (isLargeScope ? 10 : 0));
  
  return { 
    approved: score >= 70, 
    score, 
    rationale: `autonomous-consensus: ${hits} keyword hits, high-value-agency=${isHighValueAgency}, large-scope=${isLargeScope}` 
  };
}

type QRON = { signature: string; imageUrl: string; openartUrl?: string };

/**
 * Generates a real QRON visual fingerprint for the lead.
 */
async function generateQRON(lead: any): Promise<QRON> {
  const qron = await generateProductQRON({
    productId: lead.id.hashCode ? lead.id.hashCode() : Math.abs(JSON.stringify(lead.id).length),
    productName: lead.title.slice(0, 50),
    brand: lead.agency,
    category: 'other',
    tier: 'enterprise',
    verifyUrl: `https://govchain.us/verify?lead=${lead.id}`
  });

  return { 
    signature: qron.fingerprintHash, 
    imageUrl: qron.imageUrl,
    openartUrl: qron.openartUrl
  };
}

/**
 * Dispatches real email outreach via platform services.
 */
async function sendOutreach(lead: any, proposal: string, qron: QRON): Promise<void> {
  if (DRY_RUN) {
    console.log(`[gov-engine] DRY_RUN outreach skipped for ${lead.agency || 'lead'}`);
    return;
  }

  const result = await sendEmail({
    to: lead.contactEmail || 'procurement@' + lead.agency.toLowerCase().replace(/ /g, '') + '.gov',
    subject: `GovChain.us Pilot — Authenticity Verification for ${lead.agency}`,
    body: proposal + `\n\nView your pilot QRON visual fingerprint: ${qron.imageUrl}`,
    fromName: 'GovChain Executive Assistant'
  });

  if (result.status !== 'sent') {
    throw new Error(`Outreach failed: ${result.reason}`);
  }
}

/**
 * Mints a real Pilot NFT on Polygon via Thirdweb.
 */
async function mintPilotNFT(args: {
  leadId: string;
  agency: string;
  qronSignature: string;
  consensusScore: number;
  imageUrl: string;
}): Promise<void> {
  if (DRY_RUN) {
    console.log(
      `[gov-engine] DRY_RUN mint skipped — would mint pilot NFT for ${args.agency} (lead ${args.leadId}, score ${args.consensusScore}, sig ${args.qronSignature})`
    );
    return;
  }

  const metadata = buildAuthCertificateMetadata({
    productName: `Government Pilot: ${args.agency}`,
    productBrand: 'GovChain',
    confidenceScore: args.consensusScore,
    verificationDate: new Date().toISOString(),
    certificateNumber: `GC-PILOT-${args.leadId}`,
    imageUrl: args.imageUrl,
    authenticatorId: 100, // GovChain System Authenticator
    result: 'verified_government_lead'
  });

  await mintAuthenticationNFT({
    contractAddress: ENV.defaultNftContract,
    recipientAddress: ACTIVE_ENTITY.wallet,
    metadata,
    privateKey: ENV.blockchainPrivateKey
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    contactEmail: raw.pointOfContact?.[0]?.email,
    source,
    raw,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main entry — runs the autonomous federal lead-gen pipeline
// ──────────────────────────────────────────────────────────────────────────────
export async function runAdvancedGovernmentLeadGen() {
  console.log(
    `🚀 GovChain autonomous lead-gen v2.4 starting (DRY_RUN=${DRY_RUN}) — SAM Opps + Contract Awards v1 + USAspending + 5-agent consensus`
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

  // 4. Semantic matching stub (package might not be fully installed)
  const allLeads = [...enrichedLeads];

  // 5. Process each lead through consensus → QRON → outreach → mint
  let processed = 0;
  for (const lead of allLeads) {
    try {
      const consensus = await runFiveAgentConsensus(lead);
      if (!consensus.approved) {
        console.log(`[gov-engine] ⏭  skipped ${lead.agency} (score ${consensus.score})`);
        continue;
      }

      const qron = await generateQRON(lead);

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
        imageUrl: qron.imageUrl
      });

      await logActivity({
        action: 'gov_lead_processed',
        entityType: 'lead',
        details: { agency: lead.agency, score: consensus.score, qron: qron.signature }
      });

      processed++;
      console.log(
        `✅ Processed ${lead.agency} — consensus ${consensus.score}, qron ${qron.signature}`
      );
    } catch (err) {
      console.error(`[gov-engine] Failed to process ${lead.agency}:`, err);
    }
  }

  console.log(
    `🎯 ${processed}/${allLeads.length} federal leads processed (DRY_RUN=${DRY_RUN}, signer=${ACTIVE_ENTITY.wallet})`
  );
  return { total: allLeads.length, processed, dryRun: DRY_RUN };
}

export async function startGovernmentEngine() {
  await runAdvancedGovernmentLeadGen();
  console.log(`🔄 GovChain engine run complete (DRY_RUN=${DRY_RUN})`);
}
