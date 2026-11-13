import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareArbiterHandoff, validatePeerOrdering, ACCEPTED_EVIDENCE_STATE,
} from './arbiter-peer-repro.mjs';

const card = name => ({ name, description: `Agent ${name}`,
  skills: [{ name: 'read-evidence', description: 'Read published records only' }],
  secret: 'never-forward-to-ranking' });
const agents = ['alpha', 'beta', 'charlie', 'delta'].map(card);
const policy = {
  alpha: { identityVerified: true, policyAuthorized: true, evidenceState: ACCEPTED_EVIDENCE_STATE },
  beta: { identityVerified: true, policyAuthorized: true, evidenceState: ACCEPTED_EVIDENCE_STATE },
  charlie: { identityVerified: true, policyAuthorized: false, evidenceState: ACCEPTED_EVIDENCE_STATE },
  delta: { identityVerified: true, policyAuthorized: true, evidenceState: 'signed_record_anchor_claim_unobserved' },
};
const run = (list = agents, trustedGate = name => policy[name]) => prepareArbiterHandoff({
  task: 'Which permitted agent should review a published record first?', agents: list, trustedGate,
});

test('produces ARBITER-documented A2A input with only policy-approved peers', async () => {
  const result = await run();
  assert.equal(result.status, 'eligible_field_ready');
  assert.deepEqual(result.allowedAgentIds, ['alpha', 'beta']);
  assert.deepEqual(result.arbiterInput.agents.map(a => a.name), ['alpha', 'beta']);
  assert.equal(result.arbiterInput.top_k, 2);
  assert.equal(result.paidOrderingInvoked, false);
  assert.equal(result.authorizedHandoff, false);
});
test('does not forward arbitrary secrets or agent-supplied claims', async () => {
  const result = await run();
  assert.ok(!JSON.stringify(result.arbiterInput).includes('never-forward-to-ranking'));
  assert.deepEqual(Object.keys(result.arbiterInput.agents[0]), ['name', 'description', 'skills']);
});
test('an unauthorized candidate is excluded even if evidence checks pass', async () => {
  const result = await run();
  assert.deepEqual(result.excluded.find(x => x.name === 'charlie'),
    { name: 'charlie', reason: 'not_authorized' });
});
test('a signed but chain-unobserved record does not elevate evidence', async () => {
  const result = await run();
  assert.deepEqual(result.excluded.find(x => x.name === 'delta'),
    { name: 'delta', reason: 'insufficient_provenance_evidence' });
});
test('identity is a separate mandatory gate', async () => {
  const result = await run([card('alpha'), card('beta')], name => ({ ...policy[name], identityVerified: false }));
  assert.equal(result.arbiterInput, null);
  assert.equal(result.status, 'insufficient_authorized_candidates');
});
test('absent or failing trusted gate never sends candidates to a ranker', async () => {
  await assert.rejects(prepareArbiterHandoff({ task: "Review the supplied evidence", agents }), /trusted_handoff_inputs_required/);
  const result = await run(agents, async () => { throw Error('offline'); });
  assert.equal(result.arbiterInput, null);
  assert.equal(result.excluded.length, 4);
});
test('unknown, duplicated or removed candidates from ranker are rejected', async () => {
  const result = await run();
  for (const invalid of [['alpha','intruder'],['alpha','alpha'],['alpha']]) {
    assert.deepEqual(validatePeerOrdering(result, invalid),
      { valid: false, reason: 'added_removed_or_duplicated_agent' });
  }
});
test('a valid reordering still does not authorize a remote handoff', async () => {
  const result = await run();
  const order = validatePeerOrdering(result, ['beta','alpha']);
  assert.equal(order.valid, true);
  assert.equal(order.authorizedHandoff, false);
});
test('duplicate card name and malformed input fail closed', async () => {
  await assert.rejects(run([card('alpha'), card('alpha')]), /invalid_or_duplicate/);
  await assert.rejects(run([{ ...card('alpha'), name: '$injected' }]), /invalid_or_duplicate/);
});
