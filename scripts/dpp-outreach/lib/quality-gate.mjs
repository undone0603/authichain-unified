/**
 * Decision-maker quality gate for DPP outreach.
 * Rejects role inboxes, title-as-name placeholders, and untrusted provenance.
 */
import dns from 'node:dns/promises';

export const ROLE_LOCALPARTS = new Set([
  'info', 'support', 'help', 'contact', 'sales', 'admin', 'hello', 'billing',
  'noreply', 'no-reply', 'team', 'office', 'ops', 'operations', 'compliance',
  'sustainability', 'esg', 'press', 'media', 'hr', 'jobs', 'careers', 'webmaster',
]);

/** Titles that are labels, not people */
export const TITLE_AS_NAME_RE =
  /^(operations?\s+director|director|manager|compliance|owner|founder|ceo|cto|coo|vp|head of|team|staff|admin)$/i;

export const TRUSTED_SOURCES = new Set([
  'apollo_verified',
  'reacher_verified',
  'inbound_optin',
  'confirmed_reply',
  'published_contact',
  'manual_verified',
  'hubspot_crm',
]);

export const ICP_TITLE_RE =
  /founder|co-?founder|ceo|coo|chief|owner|president|vp|vice president|head of|director|compliance|regulatory|sustainability|esg|quality|product|supply chain|operations|sourcing|traceability/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isRoleInbox(email) {
  const local = normalizeEmail(email).split('@')[0] || '';
  return ROLE_LOCALPARTS.has(local);
}

export function isNamedHuman(name) {
  const n = String(name || '').trim();
  if (!n || n.length < 2) return false;
  if (TITLE_AS_NAME_RE.test(n)) return false;
  // Require at least one letter; prefer first+last but allow single given name
  if (!/[A-Za-z]/.test(n)) return false;
  if (/^(there|friend|team|sir|madam)$/i.test(n)) return false;
  return true;
}

export function titleLooksLikeDecisionMaker(title) {
  const t = String(title || '').trim();
  if (!t) return false;
  return ICP_TITLE_RE.test(t);
}

export async function domainAcceptsMail(email) {
  const domain = normalizeEmail(email).split('@')[1];
  if (!domain) return false;
  try {
    const mx = await dns.resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {object} lead
 * @param {{ checkMx?: boolean }} [opts]
 */
export async function assessDecisionMaker(lead, opts = {}) {
  const reasons = [];
  const email = normalizeEmail(lead.email);
  const name = String(lead.contact_name || lead.name || '').trim();
  const title = String(lead.role || lead.title || '').trim();
  const source = String(lead.verification_source || lead.source || 'unknown').trim();

  const validFormat = EMAIL_RE.test(email);
  if (!validFormat) reasons.push('invalid_format');

  const roleInbox = isRoleInbox(email);
  if (roleInbox) reasons.push('role_inbox');

  const named = isNamedHuman(name);
  if (!named) reasons.push('name_not_human');

  const dmTitle = titleLooksLikeDecisionMaker(title);
  if (!dmTitle) reasons.push('title_not_dm');

  const trusted = TRUSTED_SOURCES.has(source);
  if (!trusted) reasons.push(`untrusted_source:${source}`);

  let mxOk = null;
  if (opts.checkMx !== false && validFormat && !roleInbox) {
    mxOk = await domainAcceptsMail(email);
    if (!mxOk) reasons.push('no_mx');
  }

  const status =
    validFormat && !roleInbox && named && dmTitle && trusted && mxOk !== false
      ? 'allow'
      : 'reject';

  return {
    email,
    name,
    title,
    source,
    status,
    reasons,
    mxOk,
  };
}

export function linkedinPeopleQuery(company, titles) {
  const titleQ = (titles || ['compliance', 'sustainability', 'founder', 'operations'])
    .slice(0, 3)
    .join(' OR ');
  return `site:linkedin.com/in ("${company}") (${titleQ})`;
}
