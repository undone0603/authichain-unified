/**
 * No-payment interoperability adapter for ARBITER's documented A2A handoff input.
 * No wallet, ranking service, remote agent execution, or authorization decisions.
 * All gate decisions must originate in a trusted host; never use client claims.
 */
export const PROTOCOL = 'authichain-arbiter-eligibility-fixture/v1';
export const ACCEPTED_EVIDENCE_STATE = 'signed_record_tx_commitment_observed';

function validAgent(agent) {
  return agent && typeof agent === 'object' && !Array.isArray(agent) &&
    typeof agent.name === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(agent.name) &&
    typeof agent.description === 'string' && agent.description.length <= 600 &&
    Array.isArray(agent.skills) && agent.skills.length <= 20 &&
    agent.skills.every(s => s && typeof s.name === 'string' && s.name.length <= 80 &&
      typeof s.description === 'string' && s.description.length <= 400);
}

/** Host policy decisions are provided only by trusted in-process gate callback. */
export async function prepareArbiterHandoff({ task, agents, trustedGate }) {
  if (typeof task !== 'string' || task.trim().length < 10 || task.length > 2000 ||
      !Array.isArray(agents) || agents.length > 50 ||
      typeof trustedGate !== 'function') throw new TypeError('trusted_handoff_inputs_required');
  const seen = new Set();
  const eligible = [];
  const excluded = [];
  for (const agent of agents) {
    if (!validAgent(agent) || seen.has(agent.name)) throw new TypeError('invalid_or_duplicate_agent_card');
    seen.add(agent.name);
    let policy;
    try { policy = await trustedGate(agent.name); }
    catch { excluded.push({ name: agent.name, reason: 'trusted_gate_failed' }); continue; }
    // Evidence state alone never replaces identity or host authorization.
    const ok = policy && policy.identityVerified === true &&
      policy.policyAuthorized === true &&
      policy.evidenceState === ACCEPTED_EVIDENCE_STATE;
    if (!ok) {
      const reason = !policy || policy.identityVerified !== true ? 'identity_not_verified' :
        policy.policyAuthorized !== true ? 'not_authorized' : 'insufficient_provenance_evidence';
      excluded.push({ name: agent.name, reason });
      continue;
    }
    // Only ARBITER-documented public card fields cross into the candidate pool.
    eligible.push({ name: agent.name, description: agent.description,
      skills: agent.skills.map(s => ({ name: s.name, description: s.description })) });
  }
  const ready = eligible.length >= 2;
  return {
    protocol: PROTOCOL,
    mode: 'local_mock_only',
    status: ready ? 'eligible_field_ready' : 'insufficient_authorized_candidates',
    authorizedHandoff: false,
    paidOrderingInvoked: false,
    excluded,
    allowedAgentIds: eligible.map(a => a.name),
    // Exact documented ARBITER a2a-router input; do not call its paid CLI here.
    arbiterInput: ready ? { task, agents: eligible, top_k: eligible.length } : null,
  };
}

/** Validate an external ordering in the host before any A2A handoff. */
export function validatePeerOrdering(prepared, orderedIds) {
  if (!prepared || prepared.status !== 'eligible_field_ready' ||
      !Array.isArray(orderedIds) || orderedIds.some(x => typeof x !== 'string')) {
    return { valid: false, reason: 'invalid_ordering' };
  }
  const allowed = prepared.allowedAgentIds;
  const unique = new Set(orderedIds);
  if (orderedIds.length !== allowed.length || unique.size !== allowed.length ||
      orderedIds.some(id => !allowed.includes(id))) {
    return { valid: false, reason: 'added_removed_or_duplicated_agent' };
  }
  return { valid: true, orderedAgentIds: [...orderedIds],
    authorizedHandoff: false, note: 'ranking does not authorize invocation' };
}
