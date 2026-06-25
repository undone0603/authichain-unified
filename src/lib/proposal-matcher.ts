import { db } from '@/db';
import { leads, proposals } from '@/db/schema';
import { eq, desc, ilike, and } from 'drizzle-orm';

interface MatchResult {
  proposalId: string | null;
  leadId: number | null;
  confidence: number; // 0.0-1.0
  method: string; // 'exact_email' | 'subject_match' | 'thread_match' | 'no_match'
  reason?: string;
}

/**
 * Match an inbound email reply to a proposal using multiple strategies.
 * Returns match result with confidence level.
 */
export async function matchReplyToProposal(
  senderEmail: string,
  subject: string,
  messageId?: string,
  inReplyTo?: string,
): Promise<MatchResult> {
  // Strategy 1: Exact email match (highest confidence)
  const leadByEmail = await db.select().from(leads).where(eq(leads.email, senderEmail.toLowerCase())).limit(1);

  if (leadByEmail.length > 0) {
    const lead = leadByEmail[0];

    // Find most recent proposal sent to this lead
    const proposal = await db
      .select()
      .from(proposals)
      .where(eq(proposals.leadEmail, senderEmail.toLowerCase()))
      .orderBy(desc(proposals.createdAt))
      .limit(1);

    if (proposal.length > 0) {
      return {
        proposalId: proposal[0].id,
        leadId: lead.id,
        confidence: 1.0,
        method: 'exact_email',
        reason: 'Perfect match on sender email',
      };
    }
  }

  // Strategy 2: Fuzzy subject match
  const subjectMatch = matchSubjectToProposal(subject);
  if (subjectMatch) {
    return subjectMatch;
  }

  // Strategy 3: In-Reply-To header (if provided by Resend)
  if (inReplyTo) {
    const threadMatch = await matchByThreadId(inReplyTo);
    if (threadMatch) {
      return threadMatch;
    }
  }

  // No match found
  return {
    proposalId: null,
    leadId: null,
    confidence: 0,
    method: 'no_match',
    reason: 'Could not match email to any proposal',
  };
}

/**
 * Try to extract proposal ID or lead info from email subject.
 * Looks for patterns like "RE: Proposal: {company}" or "Proposal-{id}"
 */
function matchSubjectToProposal(subject: string): MatchResult | null {
  // Pattern: "RE: Proposal: Blockchain Auth for Acme Corp"
  const proposalPattern = /(?:RE|FW):\s*Proposal.*?(?:for|to)\s+([A-Za-z0-9\s&.,-]+)/i;
  const match = subject.match(proposalPattern);

  if (match && match[1]) {
    const companyName = match[1].trim();

    // Don't return a match here without verifying it exists
    // Return a low-confidence result for further investigation
    return {
      proposalId: null,
      leadId: null,
      confidence: 0.6,
      method: 'subject_match',
      reason: `Found company name "${companyName}" in subject, but could not verify proposal`,
    };
  }

  // Pattern: "Proposal-123-abc-def" (UUID-like)
  const idPattern = /Proposal[-_]?([a-f0-9-]{36})/i;
  const idMatch = subject.match(idPattern);

  if (idMatch && idMatch[1]) {
    // Return low confidence to indicate found ID but needs verification
    return {
      proposalId: idMatch[1],
      leadId: null,
      confidence: 0.7,
      method: 'subject_match',
      reason: `Found proposal ID in subject line`,
    };
  }

  return null;
}

/**
 * Attempt to match by In-Reply-To message ID (thread matching).
 * This requires tracking original email message IDs in proposals.
 */
async function matchByThreadId(inReplyTo: string): Promise<MatchResult | null> {
  // For now, this is a placeholder. In a full implementation,
  // we would store the original email's messageId in proposals.metadata
  // and look it up here.

  // Future: Query proposals where metadata.originalMessageId = inReplyTo
  // For now, return null
  return null;
}

/**
 * Helper: Extract email domain to verify legitimacy
 */
export function isValidEmailDomain(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Helper: Normalize email for comparison
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
