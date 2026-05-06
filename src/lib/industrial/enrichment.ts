/**
 * LEAD ENRICHMENT ENGINE
 * Part of the "Real Contacts for CRM" solution.
 * 
 * Strategies:
 * 1. Domain-based Enterprise Recognition (Theater-Grade)
 * 2. Professional Data Fetching (Apollo/Clearbit/FullContact)
 * 3. Autonomous Lead Scoring
 */

export interface EnrichedContact {
  email: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  company_name?: string;
  linkedin_url?: string;
  is_enterprise: boolean;
  lead_score: number; // 0-100
  theater_potential?: 'theater_1' | 'theater_2' | 'theater_3' | null;
}

const ENTERPRISE_DOMAINS = [
  'bmw.com', 'trulieve.com', 'metrc.com', 'mercedes-benz.com', 
  'tesla.com', 'apple.com', 'google.com', 'sap.com', 'salesforce.com',
  'gilmorecarmuseum.org'
];

/**
 * Analyzes an email domain to detect high-value enterprise potential.
 */
export function detectEnterpriseTheater(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  if (domain === 'bmw.com' || domain.includes('automotive')) return 'theater_3';
  if (domain === 'trulieve.com' || domain === 'metrc.com') return 'theater_1';
  if (domain.includes('museum') || domain.includes('event')) return 'theater_2';

  if (ENTERPRISE_DOMAINS.includes(domain)) return 'theater_3'; // Default to AuthiChain
  
  return null;
}

/**
 * Fetch contact details from a professional data provider (e.g. Apollo.io).
 * This is a placeholder for a real API call.
 */
export async function fetchProfessionalData(_email: string): Promise<Partial<EnrichedContact>> {
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) {
    console.warn('[enrichment] APOLLO_API_KEY missing - using heuristic fallback');
    return {};
  }

  try {
    // Simulated Apollo.io API call
    /*
    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ api_key: apolloKey, email })
    });
    const data = await res.json();
    return {
      first_name: data.person?.first_name,
      last_name: data.person?.last_name,
      job_title: data.person?.title,
      company_name: data.person?.organization?.name,
      linkedin_url: data.person?.linkedin_url
    };
    */
    return {};
  } catch (err) {
    console.error('[enrichment] Professional data fetch failed:', err);
    return {};
  }
}

/**
 * Unified Enrichment Handler: Raw Email -> Real Contact
 */
export async function enrichLead(email: string): Promise<EnrichedContact> {
  console.log(`[enrichment] Starting cycle for: ${email}`);

  // 1. Core Heuristics
  const theater = detectEnterpriseTheater(email);
  const isEnterprise = !!theater || !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(email.split('@')[1]);

  // 2. Professional Enrichment (External API)
  const proData = await fetchProfessionalData(email);

  // 3. Scoring
  let score = 10; // Base score for any lead
  if (isEnterprise) score += 40;
  if (theater) score += 30;
  if (proData.job_title) score += 20;

  return {
    email,
    is_enterprise: isEnterprise,
    lead_score: Math.min(score, 100),
    theater_potential: theater,
    ...proData
  };
}
