export type SettlementInput = {
  classDefinition?: string | null;
  jurisdiction?: string | null;
  proofRequirement?: 'none'|'self_attestation'|'low'|'receipt'|'substantial'|'unknown';
};

export type ProfileInput = {
  state?: string | null;
  statesLived?: string[];
  companiesUsed?: string[];
  productsOwned?: string[];
  subscriptions?: string[];
};

export function normalizeProofBurden(requirement: SettlementInput['proofRequirement']) {
  return ({ none: 0, self_attestation: 1, low: 1, receipt: 2, substantial: 4, unknown: 4 } as const)[requirement ?? 'unknown'];
}

export function scoreEligibility(settlement: SettlementInput, profile: ProfileInput) {
  const text = `${settlement.classDefinition ?? ''} ${settlement.jurisdiction ?? ''}`.toLowerCase();
  const profileText = JSON.stringify(profile).toLowerCase();
  const reasons: string[] = [];
  const missingFacts: string[] = [];
  let score = 35;

  if (settlement.jurisdiction && (profile.state || '').toLowerCase() === settlement.jurisdiction.toLowerCase()) {
    score += 25; reasons.push('State/jurisdiction matches profile');
  } else if (text.includes('nationwide') || text.includes('all states')) {
    score += 15; reasons.push('Settlement appears nationwide');
  } else {
    missingFacts.push('Confirm qualifying jurisdiction');
  }

  if (settlement.classDefinition && profileText && text.split(/\W+/).filter(Boolean).some(token => token.length > 5 && profileText.includes(token))) {
    score += 25; reasons.push('Potential class-definition match found');
  } else {
    missingFacts.push('Confirm qualifying product, service, date, or conduct');
  }

  if (settlement.proofRequirement === 'none') { score += 15; reasons.push('Official materials classify documentation as not required'); }
  score = Math.min(100, score);
  const eligibilityStatus = score >= 85 ? 'eligible' : score >= 60 ? 'needs_review' : score >= 35 ? 'possible' : 'unlikely';
  return { score, eligibilityStatus, reasons, missingFacts, proofBurden: normalizeProofBurden(settlement.proofRequirement) };
}

export function deadlineState(dueAt: string | Date, now = new Date()) {
  const ms = new Date(dueAt).getTime() - now.getTime();
  const days = Math.ceil(ms / 86400000);
  if (ms < 0) return { state: 'expired', days };
  if (days <= 3) return { state: 'critical', days };
  if (days <= 14) return { state: 'urgent', days };
  if (days <= 30) return { state: 'upcoming', days };
  return { state: 'future', days };
}
