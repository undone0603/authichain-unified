/**
 * Apollo.io API integration for high-quality B2B lead discovery.
 * Replaces LLM web-search with verified contact + company data.
 */
import { ENV } from "./_core/env.js";
import type { VerificationSource } from "./outreach/send-guard.js";

export interface ApolloLead {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  org: string;
  orgIndustry?: string;
  linkedinUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  seniority?: string;
  /** Apollo's own verdict on the address, mapped onto the send-guard vocabulary. */
  verificationSource: VerificationSource;
}

/**
 * Apollo returns `email_status` per person. Only "verified" means Apollo
 * actually confirmed the mailbox; "guessed" is a pattern inferred from the
 * company's format, which is precisely what send-guard.ts exists to stop
 * ("bernard.arnault@lvmh.com" passes an MX check because the domain is real).
 *
 * Anything that is not an explicit "verified" maps to a source the guard
 * rejects. Erring toward 'pattern_guess' on an unrecognised status is
 * deliberate: a new or renamed Apollo status must not silently become
 * sendable.
 */
export function mapApolloEmailStatus(status: unknown): VerificationSource {
  if (status === 'verified') return 'apollo_verified';
  if (status === 'guessed') return 'pattern_guess';
  return 'unknown';
}

/**
 * Apollo's search endpoint returns this placeholder instead of an address when
 * the contact has not been unlocked with a credit. It is a real-looking string
 * that would otherwise be inserted into `leads` and treated as a mailbox.
 */
function isLockedPlaceholder(email: string): boolean {
  return /^email_not_unlocked@/i.test(email.trim());
}

interface ApolloSearchParams {
  person_titles?: string[];
  person_seniorities?: string[];
  q_organization_keyword_tags?: string[];
  organization_industry_tag_ids?: string[];
  person_locations?: string[];
  page?: number;
  per_page?: number;
}

// Current API base + the credit-free, API-optimized people search endpoint.
// NOTE: api_search requires a PAID Apollo plan + master API key; free keys get
// HTTP 403 API_INACCESSIBLE. Emails come from the enrichment endpoints (credits).
const APOLLO_BASE = "https://api.apollo.io/api/v1";

const SEGMENT_PARAMS: Record<string, ApolloSearchParams> = {
  GOV: {
    person_titles: [
      "chief procurement officer", "director of procurement", "procurement director",
      "supply chain director", "director of operations", "program director",
      "compliance officer", "director of logistics", "operations director",
      "deputy director", "department head", "government relations",
    ],
    person_seniorities: ["director", "vp", "c_suite", "manager", "senior"],
    q_organization_keyword_tags: [
      "government", "federal", "state government", "county", "municipal",
      "department of defense", "public sector", "agency", "bureau",
    ],
  },
  RETAIL: {
    person_titles: [
      "owner", "founder", "general manager", "director of operations",
      "buyer", "head of procurement", "retail director", "store director",
      "vp of retail", "chief operating officer", "dispensary manager",
    ],
    person_seniorities: ["owner", "founder", "director", "vp", "c_suite", "manager"],
    q_organization_keyword_tags: [
      "dispensary", "retail", "cannabis", "specialty retail", "boutique",
      "consumer goods", "pharmacy", "health and wellness",
    ],
  },
  PRESS: {
    person_titles: [
      "journalist", "reporter", "editor", "senior writer", "technology reporter",
      "crypto reporter", "blockchain reporter", "fintech editor",
    ],
    person_seniorities: ["senior", "manager", "director", "c_suite"],
    q_organization_keyword_tags: [
      "media", "press", "news", "publication", "magazine", "online media",
      "technology media", "crypto", "fintech",
    ],
  },
  PARTNER: {
    person_titles: [
      "vp of partnerships", "head of partnerships", "business development",
      "director of alliances", "channel director", "vp of business development",
    ],
    person_seniorities: ["director", "vp", "c_suite", "manager"],
    q_organization_keyword_tags: [
      "software", "technology", "saas", "platform", "integration", "api",
    ],
  },
};

export async function apolloSearchLeads(segment: string, count: number): Promise<ApolloLead[]> {
  if (!ENV.apolloApiKey) {
    return [];
  }

  const params = SEGMENT_PARAMS[segment] ?? SEGMENT_PARAMS.GOV;
  const body = {
    ...params,
    page: 1,
    per_page: Math.min(count, 25),
  };

  const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": ENV.apolloApiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apollo API error ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => ({ people: [] })) as any;
  const people: any[] = data?.people ?? [];

  return people
    .filter(p => p.email && p.name && p.organization?.name)
    .filter(p => !isLockedPlaceholder(p.email))
    .map(p => ({
      name: p.name ?? `${p.first_name} ${p.last_name}`.trim(),
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      email: p.email,
      title: p.title ?? "",
      org: p.organization?.name ?? "",
      orgIndustry: p.organization?.industry ?? undefined,
      linkedinUrl: p.linkedin_url ?? undefined,
      city: p.city ?? undefined,
      state: p.state ?? undefined,
      country: p.country ?? undefined,
      seniority: p.seniority ?? undefined,
      verificationSource: mapApolloEmailStatus(p.email_status),
    }));
}
