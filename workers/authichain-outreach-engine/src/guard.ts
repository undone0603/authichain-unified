// Lead-level checks for authichain-outreach-engine. Pure functions only; the
// network checks (MX lookup, prior sends) live in index.ts.
//
// What these rules stop, taken from leads that were actually in this table:
// - "tracking@dea.gov", "trade-ops@cbp.dhs.gov": guessed government addresses.
// - contact_name "Pilot Coordinator" / "Director of Trade": a job title used as
//   a name, which rendered as "Hi Pilot Coordinator,".
// - company "AuthiChain OS — Arc'teryx Gear Authentication (AMER)": a brainstorm
//   placeholder stored as if it were a prospect, with an invented domain.
// - source "agentz" with no evidence of where the address came from.

import {
  assessRecipient,
  TRUSTED_SOURCES,
  type VerificationSource,
} from "../../../server/outreach/recipient-rules";

export interface LeadMetadata {
  verification_source?: string;
  /** Where the address came from: a URL, an Apollo id, or an inbound form id. */
  verification_evidence?: string;
  personal_note?: string;
  personal_note_source?: string;
}

export interface LeadInput {
  email: string;
  name: string | null;
  company: string | null;
  metadata: LeadMetadata;
}

export interface LeadCheck {
  ok: boolean;
  reasons: string[];
  first_name: string;
}

const TITLE_WORDS =
  /\b(director|manager|coordinator|lead|head|officer|chief|vp|vice|president|team|department|dept|office|desk|support|pilot|procurement|compliance|operations|ops|partnerships?|marketing|sales|admin|staff|supervisor|specialist|analyst|engineer|executive|founder|owner|contact|inquiries|info|general)\b/i;

const OWN_BRANDS = /\b(authichain|qron|strainchain|govchain)\b/i;

const URL_RE = /^https?:\/\/\S+\.\S+/i;

export function parseMetadata(raw: string | null | undefined): LeadMetadata {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as LeadMetadata) : {};
  } catch {
    return {};
  }
}

/** A person's name, not a job title, placeholder or email. Returns the first name or null. */
export function personFirstName(name: string | null | undefined): string | null {
  const n = (name ?? "").trim();
  if (n.length < 2) return null;
  if (/[@\d]/.test(n)) return null;
  if (TITLE_WORDS.test(n)) return null;
  if (!/^[\p{L}][\p{L}'’.\- ]*$/u.test(n)) return null;
  return n.split(/\s+/)[0];
}

export function checkLead(lead: LeadInput): LeadCheck {
  const reasons: string[] = [];
  const email = (lead.email ?? "").trim().toLowerCase();
  const meta = lead.metadata ?? {};

  const source = (meta.verification_source ?? "unknown") as VerificationSource;
  const recipient = assessRecipient(email, source);
  reasons.push(...recipient.reasons);
  if (TRUSTED_SOURCES.has(source) && !(meta.verification_evidence ?? "").trim()) {
    reasons.push("missing_verification_evidence");
  }
  if (source === "published_contact" && !URL_RE.test(meta.verification_evidence ?? "")) {
    reasons.push("published_contact_needs_source_url");
  }

  const first = personFirstName(lead.name);
  if (!first) reasons.push("contact_name_not_a_person");

  const company = (lead.company ?? "").trim();
  if (!company) reasons.push("missing_company");
  else if (OWN_BRANDS.test(company)) reasons.push("company_names_our_own_product");
  else if (/ [—|] /.test(company)) reasons.push("company_looks_synthetic");

  const noteText = (meta.personal_note ?? "").trim();
  if (noteText && !URL_RE.test(meta.personal_note_source ?? "")) {
    reasons.push("personal_note_needs_source_url");
  }

  return { ok: reasons.length === 0, reasons, first_name: first ?? "" };
}
