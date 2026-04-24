/**
 * @authichain/vector-store
 *
 * Adapter layer that bridges OpenSAM's vectorStoreServerUtils
 * (libs/opensam/src/lib/vectorStore-server.ts) to the call signature
 * used by src/agents/government-lead-gen-v2.ts:
 *
 *   vectorStoreUtils.findMatchingOpportunities({ companyProfile, limit })
 *   => Promise<SAMOpportunity[] with .id, .agency, .contact, .title>
 *
 * ENVIRONMENT VARIABLES required (set in Vercel / GitHub Actions secrets):
 *   VECTOR_STORE_PROVIDER = "pinecone" | "chroma"  (default: pinecone)
 *   PINECONE_API_KEY      - Pinecone API key
 *   PINECONE_INDEX        - Pinecone index name       (default: authichain-opportunities)
 *   PINECONE_ENVIRONMENT  - Pinecone environment/region
 *   CHROMA_HOST           - ChromaDB host             (if using chroma)
 *   OPENAI_API_KEY        - For text embeddings (OpenSAM uses OpenAI by default)
 *   SAM_API_KEY           - SAM.gov public API key (for opportunity ingestion)
 */

// ──────────────────────────────────────────────────────────────────────────────
// Types re-exported from OpenSAM so callers don't import from submodule directly
// ──────────────────────────────────────────────────────────────────────────────

export interface AuthiChainCompanyProfile {
  id: string;
  entityName: string;
  description: string;
  capabilities: string[];
  naicsCodes: string[];
  businessTypes?: string[];
  pastPerformance?: string[];
  certifications?: string[];
  ueiSAM?: string;
  contactInfo?: {
    address?: string;
    city?: string;
    state?: string;
    website?: string;
  };
}

export interface GovernmentOpportunity {
  id: string;
  noticeId?: string;
  title: string;
  agency: string;        // mapped from organizationType or title prefix
  contact?: string;      // pointOfContact[0].fullName
  synopsis?: string;
  naicsCode?: string;
  responseDeadLine?: string;
  uiLink?: string;
  score?: number;        // semantic similarity score from vector search
  active?: boolean;
}

export interface FindOpportunitiesInput {
  companyProfile: AuthiChainCompanyProfile;
  limit?: number;        // maps to topK (default 20)
}

// ──────────────────────────────────────────────────────────────────────────────
// Lazy-load OpenSAM server utils (server-side only; safe in Node / CF Workers)
// ──────────────────────────────────────────────────────────────────────────────

async function getOpenSAMUtils() {
  // Dynamic import so this module can be imported in edge/browser without
  // pulling in chromadb / @pinecone-database/pinecone at build time.
  const mod = await import(
    /* webpackIgnore: true */
    '../../libs/opensam/src/lib/vectorStore-server'
  );
  return mod.vectorStoreServerUtils;
}

// ──────────────────────────────────────────────────────────────────────────────
// SAM.gov opportunity ingestion (call this once / on cron to populate the store)
// ──────────────────────────────────────────────────────────────────────────────

export async function ingestSAMOpportunities(keywords: string[] = []): Promise<void> {
  try {
    const samApiKey = process.env.SAM_API_KEY;
    if (!samApiKey) {
      console.warn('[vector-store] SAM_API_KEY not set — skipping SAM.gov ingestion');
      return;
    }

    const defaultKeywords = [
      'counterfeit prevention',
      'product authentication',
      'QR verification',
      'supply chain traceability',
      'document authentication',
      'blockchain provenance',
      ...keywords,
    ];

    // Build SAM.gov API query
    const query = defaultKeywords.slice(0, 3).join(' OR ');
    const url = `https://api.sam.gov/opportunities/v2/search?api_key=${samApiKey}&q=${encodeURIComponent(query)}&limit=100&postedFrom=01/01/2026`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[vector-store] SAM.gov API error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json();
    const opportunities = (data.opportunitiesData || []) as any[];

    if (opportunities.length === 0) {
      console.log('[vector-store] No SAM.gov opportunities returned for query');
      return;
    }

    const utils = await getOpenSAMUtils();

    for (const opp of opportunities) {
      await utils.addOpportunity(opp);
    }

    console.log(`[vector-store] Ingested ${opportunities.length} SAM.gov opportunities into vector store`);
  } catch (err) {
    console.error('[vector-store] ingestSAMOpportunities failed:', err);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main export — the vectorStoreUtils object consumed by government-lead-gen-v2.ts
// ──────────────────────────────────────────────────────────────────────────────

export const vectorStoreUtils = {
  /**
   * Find SAM.gov opportunities semantically matching the company profile.
   * Automatically upserts the company profile embedding on first call.
   *
   * Returns GovernmentOpportunity[] sorted by descending score.
   */
  async findMatchingOpportunities(
    input: FindOpportunitiesInput
  ): Promise<GovernmentOpportunity[]> {
    const { companyProfile, limit = 20 } = input;

    try {
      const utils = await getOpenSAMUtils();

      // Map AuthiChain profile type → OpenSAM CompanyProfile type
      const openSAMProfile = {
        id: companyProfile.id,
        entityName: companyProfile.entityName,
        description: companyProfile.description,
        capabilities: companyProfile.capabilities,
        naicsCodes: companyProfile.naicsCodes,
        businessTypes: companyProfile.businessTypes || [],
        pastPerformance: companyProfile.pastPerformance || [],
        certifications: companyProfile.certifications || [],
        ueiSAM: companyProfile.ueiSAM || '',
        contactInfo: companyProfile.contactInfo || {},
      };

      // Ensure profile is embedded in the vector store
      await utils.addCompanyProfile(openSAMProfile);

      // Run semantic search
      const matches = await utils.findMatchingOpportunities(openSAMProfile, limit);

      if (!matches || matches.length === 0) {
        console.warn('[vector-store] No matching opportunities found — vector store may be empty. Run ingestSAMOpportunities() first.');
        return [];
      }

      // Map OpenSAM result shape → GovernmentOpportunity
      return matches.map(({ opportunity: opp, score }) => ({
        id: opp.id || opp.noticeId || `opp_${Date.now()}`,
        noticeId: opp.noticeId,
        title: opp.title || '',
        // Derive agency from the opportunity's organization info or title
        agency: deriveAgency(opp),
        contact: opp.pointOfContact?.[0]?.fullName || undefined,
        synopsis: opp.synopsis || opp.description || '',
        naicsCode: opp.naicsCode || '',
        responseDeadLine: opp.responseDeadLine || '',
        uiLink: opp.uiLink || '',
        score,
        active: opp.active ?? true,
      }));
    } catch (err) {
      console.error('[vector-store] findMatchingOpportunities failed:', err);
      return [];
    }
  },

  /** Expose raw ingestion for cron / manual trigger */
  ingestSAMOpportunities,
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const AGENCY_PATTERNS: Record<string, RegExp> = {
  DHS:       /\bDHS\b|Homeland Security|SVIP|CBP|TSA|CISA/i,
  DLA:       /\bDLA\b|Defense Logistics/i,
  'NIST/CHIPS': /\bNIST\b|CHIPS Act|metrology|National Institute of Standards/i,
  FDA:       /\bFDA\b|Food and Drug|pharma/i,
  VA:        /\bVA\b|Veterans Affairs/i,
  GSA:       /\bGSA\b|General Services/i,
  DoD:       /\bDoD\b|Department of Defense|DARPA|SOCOM/i,
  'FDA/VA/GSA': /FDA.*VA|VA.*GSA|GSA.*FDA/i,
};

function deriveAgency(opp: any): string {
  const haystack = [
    opp.title || '',
    opp.synopsis || '',
    opp.organizationType || '',
    opp.department || '',
  ].join(' ');

  for (const [agency, pattern] of Object.entries(AGENCY_PATTERNS)) {
    if (pattern.test(haystack)) return agency;
  }
  return opp.organizationType || 'Federal Agency';
}
