/**
 * Classify HubSpot, Airtable, and Apollo rows for the revenue operator.
 * A CRM record is not Stripe cash. Provenance is send-guard + Apollo.
 */

import { mapApolloEmailStatus } from "../server/apollo-service";
import type { VerificationSource } from "../server/outreach/send-guard";
import { isFounderEmail } from "./revenue-operator";

export const AIRTABLE_OPS_BASE_ID = "app4lw5wNMNmzTNMn";
export const AIRTABLE_ACCOUNTS_TABLE_ID = "tbldnt00sBS19wxni";
export const AIRTABLE_CONTACTS_TABLE_ID = "tblzqajBTmfn2iHv9";

const DEMO_ACCOUNTS = new Set(
  [
    "bioshield",
    "solstice botanicals",
    "highland heritage distillers",
    "cascade defense",
    "verdant apex",
    "nexura biologics",
    "aura horology",
    "mta logistics",
  ].map(s => s.toLowerCase())
);

const FABRICATED_SEED = new Set(
  ["lvmh", "pfizer", "rolex", "gucci", "bmw"].map(s => s.toLowerCase())
);

const DO_NOT_CONTACT_EMAILS = new Set(
  [
    "realthcv@gmail.com",
    "beth.ferracone@curaleaf.com",
    "wendy.linscott@curaleaf.com",
    "juliette.leavey@curaleaf.com",
  ].map(s => s.toLowerCase())
);

const CHURNED = new Set([
  "churned",
  "not interested",
  "bounced",
  "do not contact",
]);

export type CrmContactVerdict = {
  namedHuman: boolean;
  doNotContact: boolean;
  source: VerificationSource;
  reason: string;
};

export type CrmDealVerdict = {
  countsAsRevenue: boolean;
  reason: string;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isNamedPerson(
  firstname?: string | null,
  lastname?: string | null
): boolean {
  const first = norm(firstname);
  const last = norm(lastname);
  if (!first || !last) return false;
  if (/^test$/i.test(first) && /^lead$/i.test(last)) return false;
  return true;
}

export function classifyHubSpotContact(contact: {
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  source?: VerificationSource;
}): CrmContactVerdict {
  const email = norm(contact.email).toLowerCase();
  const source = contact.source ?? "unknown";
  if (!email) {
    return {
      namedHuman: false,
      doNotContact: true,
      source: "unknown",
      reason: "HubSpot contact has no email",
    };
  }
  if (isFounderEmail(email) || DO_NOT_CONTACT_EMAILS.has(email)) {
    return {
      namedHuman: isNamedPerson(contact.firstname, contact.lastname),
      doNotContact: true,
      source,
      reason: "do not contact",
    };
  }
  const namedHuman = isNamedPerson(contact.firstname, contact.lastname);
  if (!namedHuman) {
    return {
      namedHuman: false,
      doNotContact: false,
      source: source === "apollo_verified" ? source : "unknown",
      reason: "HubSpot row is not a named human",
    };
  }
  return {
    namedHuman: true,
    doNotContact: false,
    source,
    reason: "named HubSpot human; still not a send unless classifySend allows",
  };
}

export function classifyHubSpotDeal(deal: {
  dealname?: string | null;
  amount?: string | number | null;
}): CrmDealVerdict {
  const name = norm(deal.dealname);
  if (/^high-activity user:/i.test(name) || /^power agent:/i.test(name)) {
    return {
      countsAsRevenue: false,
      reason: "scan/XP milestone deal is not Stripe cash",
    };
  }
  return {
    countsAsRevenue: false,
    reason: "HubSpot deal is not livemode classifyRevenue",
  };
}

export function classifyAirtableAccount(account: {
  name?: string | null;
  status?: string | null;
  email?: string | null;
}): CrmContactVerdict {
  const name = norm(account.name).toLowerCase();
  const status = norm(account.status).toLowerCase();
  const email = norm(account.email).toLowerCase();
  if (DEMO_ACCOUNTS.has(name) || FABRICATED_SEED.has(name)) {
    return {
      namedHuman: false,
      doNotContact: true,
      source: "unknown",
      reason: "demo or fabricated CRM seed",
    };
  }
  if (CHURNED.has(status) || DO_NOT_CONTACT_EMAILS.has(email)) {
    return {
      namedHuman: false,
      doNotContact: true,
      source: "unknown",
      reason: "churned or do-not-contact",
    };
  }
  if (!email) {
    return {
      namedHuman: false,
      doNotContact: false,
      source: "unknown",
      reason: "Airtable account has no email",
    };
  }
  return {
    namedHuman: false,
    doNotContact: false,
    source: "unknown",
    reason: "Airtable row is not a send; wait for a named inbox this turn",
  };
}

export function classifyApolloLead(lead: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailStatus?: unknown;
}): CrmContactVerdict {
  const email = norm(lead.email);
  if (!email || /^email_not_unlocked@/i.test(email)) {
    return {
      namedHuman: false,
      doNotContact: true,
      source: "unknown",
      reason: "Apollo email is locked or missing",
    };
  }
  const source = mapApolloEmailStatus(lead.emailStatus);
  const namedHuman = isNamedPerson(lead.firstName, lead.lastName);
  if (isFounderEmail(email) || DO_NOT_CONTACT_EMAILS.has(email.toLowerCase())) {
    return {
      namedHuman,
      doNotContact: true,
      source,
      reason: "do not contact",
    };
  }
  return {
    namedHuman,
    doNotContact: false,
    source,
    reason:
      source === "apollo_verified"
        ? "Apollo verified; still needs classifySend this turn"
        : "Apollo did not verify this mailbox",
  };
}
