/**
 * Fill a B2B target email without paying for Apollo.
 *
 * Order: explicit target email → existing CRM/Supabase lead with trusted
 * provenance → HubSpot inbound contact → Apollo (if the plan actually
 * includes API access). Never synthesises a pattern-guess. A miss returns a
 * skip reason the outreach script can print once per cause.
 */
import { normalizeContactEmail } from "./contact-email";
import type { VerificationSource } from "../../server/outreach/send-guard";

export type LeadEmailSkipReason =
  | "already_set"
  | "crm_trusted"
  | "hubspot_inbound"
  | "apollo_verified"
  | "apollo_unconfigured"
  | "apollo_plan_blocked"
  | "apollo_no_match"
  | "hubspot_untrusted_provenance"
  | "no_verified_email";

export type ResolvedLeadEmail = {
  email: string;
  source: VerificationSource;
  via: LeadEmailSkipReason;
};

export type LeadEmailMiss = {
  email: "";
  source: VerificationSource;
  via: LeadEmailSkipReason;
};

export type LeadEmailLookup = ResolvedLeadEmail | LeadEmailMiss;

export type LeadEmailTarget = {
  company: string;
  name?: string;
  website?: string;
  email?: string;
  source?: VerificationSource;
};

const TRUSTED_SOURCES: ReadonlySet<VerificationSource> = new Set([
  "apollo_verified",
  "reacher_verified",
  "inbound_optin",
  "confirmed_reply",
  "published_contact",
]);

const WRONG_DESK = new Set([
  "ir",
  "media",
  "press",
  "webmaster",
  "webart",
  "info",
  "support",
  "help",
  "contact",
  "sales",
  "admin",
  "hello",
  "billing",
  "noreply",
  "no-reply",
  "team",
  "office",
]);

const HUBSPOT_INBOUND_STAGES = new Set([
  "subscriber",
  "lead",
  "marketingqualifiedlead",
  "salesqualifiedlead",
  "opportunity",
  "customer",
]);

const HUBSPOT_INBOUND_SOURCES = new Set([
  "ORGANIC_SEARCH",
  "DIRECT_TRAFFIC",
  "REFERRALS",
  "SOCIAL_MEDIA",
  "EMAIL_MARKETING",
  "OFFLINE",
]);

export type LeadRow = {
  email?: string | null;
  company?: string | null;
  metadata?: { source?: string } | null;
};

export type HubSpotContact = {
  properties?: {
    email?: string;
    lifecyclestage?: string;
    hs_analytics_source?: string;
    company?: string;
  };
};

let apolloEntitlementBlocked = false;
let apolloUnconfiguredLogged = false;

export function resetLeadEmailResolverState(): void {
  apolloEntitlementBlocked = false;
  apolloUnconfiguredLogged = false;
}

export function isApolloEntitlementBlocked(): boolean {
  return apolloEntitlementBlocked;
}

function usableEmail(raw: unknown): string {
  const email = normalizeContactEmail(raw);
  if (!email) return "";
  if (email.startsWith("[pending]@")) return "";
  const local = email.split("@")[0] ?? "";
  if (WRONG_DESK.has(local)) return "";
  return email;
}

function trustedSource(raw: unknown): VerificationSource | null {
  if (typeof raw !== "string") return null;
  return TRUSTED_SOURCES.has(raw as VerificationSource)
    ? (raw as VerificationSource)
    : null;
}

export function findTrustedCrmEmail(
  company: string,
  rows: LeadRow[]
): ResolvedLeadEmail | null {
  const needle = company.trim().toLowerCase();
  for (const row of rows) {
    if ((row.company ?? "").trim().toLowerCase() !== needle) continue;
    const email = usableEmail(row.email);
    const source = trustedSource(row.metadata?.source);
    if (email && source) {
      return { email, source, via: "crm_trusted" };
    }
  }
  return null;
}

export function findTrustedHubSpotEmail(
  company: string,
  contacts: HubSpotContact[]
): LeadEmailLookup | null {
  const needle = company.trim().toLowerCase();
  let sawUntrusted = false;
  for (const contact of contacts) {
    const props = contact.properties ?? {};
    if (
      (props.company ?? "").trim().toLowerCase() &&
      (props.company ?? "").trim().toLowerCase() !== needle
    ) {
      continue;
    }
    const email = usableEmail(props.email);
    if (!email) continue;
    const stage = (props.lifecyclestage ?? "").toLowerCase();
    const src = props.hs_analytics_source ?? "";
    if (HUBSPOT_INBOUND_STAGES.has(stage) || HUBSPOT_INBOUND_SOURCES.has(src)) {
      return { email, source: "inbound_optin", via: "hubspot_inbound" };
    }
    sawUntrusted = true;
  }
  if (sawUntrusted) {
    return {
      email: "",
      source: "unknown",
      via: "hubspot_untrusted_provenance",
    };
  }
  return null;
}

export async function apolloFindEmail(
  name: string,
  company: string,
  website: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ email: string; skip?: LeadEmailSkipReason }> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    return { email: "", skip: "apollo_unconfigured" };
  }
  if (apolloEntitlementBlocked) {
    return { email: "", skip: "apollo_plan_blocked" };
  }

  try {
    const domain = website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ");

    const res = await fetchImpl(
      "https://api.apollo.io/api/v1/mixed_people/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": key,
        },
        body: JSON.stringify({
          q_organization_name: company,
          person_titles: [],
          contact_email_status: ["verified", "guessed"],
          organization_domains: [domain],
          page: 1,
          per_page: 5,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 403 || body.includes("API_INACCESSIBLE")) {
        apolloEntitlementBlocked = true;
        return { email: "", skip: "apollo_plan_blocked" };
      }
      return { email: "", skip: "apollo_no_match" };
    }
    const data = (await res.json()) as {
      people?: Array<{
        first_name?: string;
        last_name?: string;
        email?: string;
      }>;
    };
    const people = data.people ?? [];
    const match =
      people.find(p => {
        const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase();
        return (
          full.includes(firstName.toLowerCase()) &&
          (!lastName || full.includes(lastName.toLowerCase()))
        );
      }) ?? people[0];
    const email = usableEmail(match?.email);
    return email ? { email } : { email: "", skip: "apollo_no_match" };
  } catch {
    return { email: "", skip: "apollo_no_match" };
  }
}

export function describeSkipReason(via: LeadEmailSkipReason): string {
  switch (via) {
    case "apollo_unconfigured":
      return "APOLLO_API_KEY unset — skipping Apollo. Fill from CRM/HubSpot or a published company address; do not buy an Apollo upgrade.";
    case "apollo_plan_blocked":
      return "Apollo API is not on this account's plan (API_INACCESSIBLE). Remaining Apollo lookups skipped. Use CRM/HubSpot or published addresses — do not upgrade Apollo on the $0 path.";
    case "apollo_no_match":
      return "Apollo returned no usable address.";
    case "hubspot_untrusted_provenance":
      return "HubSpot has a contact but no inbound/opt-in provenance — send guard would refuse it.";
    case "no_verified_email":
      return "No trusted email in the target, CRM, HubSpot, or Apollo.";
    default:
      return via;
  }
}

export function logApolloSkipOnce(
  via: LeadEmailSkipReason,
  log: (msg: string) => void = console.warn
): void {
  if (via === "apollo_unconfigured" && !apolloUnconfiguredLogged) {
    apolloUnconfiguredLogged = true;
    log(`  ⛔ ${describeSkipReason(via)}`);
  }
  if (via === "apollo_plan_blocked" && apolloEntitlementBlocked) {
    // First 403 sets the flag; print once on that transition by checking a
    // one-shot on the same flag via the unconfigured logger slot... use
    // apolloUnconfiguredLogged as "already explained a global skip".
    if (!apolloUnconfiguredLogged) {
      apolloUnconfiguredLogged = true;
      log(`  ⛔ ${describeSkipReason(via)}`);
    }
  }
}

export async function resolveLeadEmail(
  target: LeadEmailTarget,
  opts: {
    crmRows?: LeadRow[];
    hubspotContacts?: HubSpotContact[];
    fetchImpl?: typeof fetch;
  } = {}
): Promise<LeadEmailLookup> {
  const existing = usableEmail(target.email);
  if (existing) {
    return {
      email: existing,
      source: target.source ?? "published_contact",
      via: "already_set",
    };
  }

  const crm = findTrustedCrmEmail(target.company, opts.crmRows ?? []);
  if (crm) return crm;

  if (opts.hubspotContacts) {
    const hs = findTrustedHubSpotEmail(target.company, opts.hubspotContacts);
    if (hs?.email) return hs;
    if (hs?.via === "hubspot_untrusted_provenance") {
      // Keep looking (Apollo) but remember this if nothing else hits.
    }
  }

  const apollo = await apolloFindEmail(
    target.name ?? target.company,
    target.company,
    target.website ?? "",
    opts.fetchImpl ?? fetch
  );
  logApolloSkipOnce(apollo.skip ?? "apollo_no_match");
  if (apollo.email) {
    return {
      email: apollo.email,
      source: "apollo_verified",
      via: "apollo_verified",
    };
  }

  if (opts.hubspotContacts) {
    const hs = findTrustedHubSpotEmail(target.company, opts.hubspotContacts);
    if (hs && !hs.email) return hs;
  }

  return {
    email: "",
    source: target.source ?? "unknown",
    via: apollo.skip ?? "no_verified_email",
  };
}

export async function loadCrmRowsForCompanies(
  supabase: { from: (table: string) => any },
  companies: string[]
): Promise<LeadRow[]> {
  if (!companies.length) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("email, company, metadata")
    .in("company", companies);
  if (error) {
    console.warn(`  ⚠️  CRM lead lookup failed: ${error.message}`);
    return [];
  }
  return (data ?? []) as LeadRow[];
}

export async function loadHubSpotContactsForCompany(
  company: string,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<HubSpotContact[]> {
  if (!token) return [];
  try {
    const res = await fetchImpl(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "company", operator: "EQ", value: company },
              ],
            },
          ],
          properties: [
            "email",
            "firstname",
            "lastname",
            "company",
            "lifecyclestage",
            "hs_analytics_source",
          ],
          limit: 5,
        }),
      }
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.warn(
          `  ⛔ HubSpot token rejected (HTTP ${res.status}) — skipping CRM fill for ${company}`
        );
      } else {
        console.warn(`  ⚠️  HubSpot search HTTP ${res.status} for ${company}`);
      }
      return [];
    }
    const data = (await res.json()) as { results?: HubSpotContact[] };
    return data.results ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `  ⚠️  HubSpot lookup failed for ${company}: ${message.slice(0, 80)}`
    );
    return [];
  }
}
