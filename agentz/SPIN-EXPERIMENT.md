# SPIN — bounded AgentZ self-model experiment

**SPIN** here means **State, Perception, Intent, Narrative**. It is an
opt-in cognitive-architecture prototype, **not a claim or test of subjective
experience, sentience, or synthetic consciousness**. No evidence establishes
that quantum spin or an internal feedback cycle produces consciousness.

## What is implemented

- Every cycle accepts explicit bounded observations with evidence identifiers
  and uncertainty estimates; no LLM guesses are labeled as verified facts.
- Proposed intents cite evidence and remain **proposals**, not executable jobs.
  External actions, payment, deployment, writing, messaging, changes to policy,
  self-modification, and unknown categories remain **operator-held**.
- Every cycle produces a canonical SHA-256 digest and references the previous
  digest, making accidental mutation detectable. A hash is **not** a signature
  and does **not** prove inputs true.
- Cycles have hard limits. There are no API keys, provider calls, timers,
  loops that run in the background, GitHub writes, Cloudflare deploys, or
  automatic persistence. No production runtime imports this module.

## Local execution

From the repository root, in a Python environment supported by AgentZ:

```sh
python -m unittest agentz.tests.test_spin_experiment
```

Example in an interactive local Python session:

```python
from agentz.spin_experiment import Evidence, Intent, spin_cycle

frame = spin_cycle(
    evidence=(Evidence("build-1", "CI Main failed with no job steps", 0.95),),
    intents=(Intent("Investigate runner allocation", "analyze", ("build-1",)),),
)
assert frame.intents[0].status == "proposed_only"
assert frame.consciousness_claim == "not_assessed"
```


## Focus-of-focus — observing attention without executing it

`agentz/spin_focus.py` accepts one existing, digest-verified SPIN frame and
operator-supplied ratings of each proposed intent's relevance and novelty.
It chooses **only an unexecuted proposal** with sufficient cited evidence:

```python
from agentz.spin_experiment import Evidence, Intent, spin_cycle
from agentz.spin_focus import FocusCandidate, inspect_own_focus, inspect_focus_review

frame = spin_cycle(
    (Evidence("ci-1", "CI jobs failed before execution", .95),),
    (Intent("Audit CI runner eligibility", "analyze", ("ci-1",)),),
)
review = inspect_own_focus(
    frame, "verify safe customer fulfillment",
    (FocusCandidate(intent_index=0, relevance=.9, novelty=.1),),
)
assert inspect_focus_review(frame, review) == "proposal_only_no_execution"
```

The review records evidence-derived priority, attention drift (unweighted
relevance gap), and a second-order tamper check. **Ratings are subjective
inputs, not automatically verified facts.** A held intent, weak evidence, or
unrecognized action category cannot become executable. A high novelty score
reduces priority when it exceeds objective relevance; it never creates
permissions. No internal component assigns itself authorization.

Run the complete local sandbox tests using:

```sh
python -m unittest discover -s agentz/tests -p 'test_spin*.py' -v
```

On 2026-11-02, an isolated local Python 3 interpreter executed **13/13 tests**
for the exact four Git blob hashes committed to PR #2282. This proves only
these local code paths, not the full repository's CI, platform deployment, or
synthetic consciousness. The module has not been integrated into production.

## Research follow-up

Measure source-grounding, calibration, drift across cycles, audit integrity,
and human review quality **against baselines**. Do not infer phenomenal
consciousness from linguistic behavior, a self-model, a confidence number, or
a claimed subjective feeling. Before any connection to AgentZ production,
design a separate risk-reviewed interface with budgets, identity, policy
checks, capability scoping, no external execution by default, and manual
approvals for economic/outbound/deployment actions.

This experiment must never bypass `humanHold`, `production_send=false`,
existing required reviews, or Cloudflare production release gates.
