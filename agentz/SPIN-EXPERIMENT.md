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
