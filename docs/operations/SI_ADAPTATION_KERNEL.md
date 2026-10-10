# SI Adaptation Kernel

## Purpose

AuthiChain's SI-oriented objective is treated as a measurable engineering program,
not a claim of achieved superintelligence.

The kernel improves decision quality by closing the loop between observed system
state and measured outcomes.

```
OBSERVE
  ↓
REPRESENT STATE
  ↓
HYPOTHESIZE
  ↓
GENERATE OPTIONS
  ↓
SCORE / SELECT
  ↓
ACT
  ↓
MEASURE OUTCOME
  ↓
UPDATE MEMORY
  ↓
RECALIBRATE
  ↓
REPEAT
```

## Existing system that was reverse-engineered

| Layer | Existing implementation | Adaptation role |
|---|---|---|
| Observe | `Governor._observe()` | gathers workflow, credential, protocol, deployment, trend and business state |
| Measure | `Supervisor` + specialists | evaluates workflow health and failure rates |
| Bottleneck | `calculate_launch_score()` | turns state into a prioritized constraint |
| Plan | Governor LLM planner | generates candidate actions |
| Risk | risk firewall | blocks unsafe actions |
| Execute | Runner / registry | performs approved workflow actions |
| Verify | post-cycle score/stage | measures whether the intervention helped |
| Learn | score history + adaptive strategy | carries trends between cycles |

## New adaptation kernel

`agentz/core/si_adaptation.py` adds an explicit model-independent learning layer.

It provides:

- outcome memory per action;
- incremental mean improvement estimates;
- success-rate calibration;
- exploration of under-tested actions;
- cost penalty;
- latency penalty;
- normalized risk penalty;
- deterministic tie-breaking;
- auditable candidate scores.

The selector intentionally does not depend on a particular LLM.

## Selection model

For each candidate action:

```
utility =
  expected_gain × confidence_factor
  + exploration_bonus
  - cost_penalty
  - latency_penalty
  - risk_penalty
```

Historical observations update the expected gain and confidence.

This allows the system to distinguish:

- an action that merely sounds promising;
- an action that repeatedly produces measured improvement;
- an action whose improvement is too expensive;
- an action whose improvement is unsafe;
- an action that is under-tested and deserves controlled exploration.

## SI superiority measurement

Do not measure "intelligence" with a single model benchmark.

Measure the system's ability to improve its own operational decision process:

1. prediction accuracy of action outcomes;
2. mean objective improvement per intervention;
3. recovery rate after regressions;
4. adaptation speed after environmental change;
5. unnecessary-action rate;
6. cost per successful improvement;
7. latency per successful improvement;
8. policy/security violation rate;
9. calibration of confidence;
10. diversity of successfully explored strategies.

A stronger system is one that improves these metrics over time without relaxing
security or governance constraints.

## Safety invariant

Adaptation may change:

- priorities;
- action ranking;
- exploration rate;
- resource allocation recommendations;
- strategy selection.

Adaptation may not silently change:

- cryptographic verification;
- identity trust;
- revocation;
- permission boundaries;
- audit requirements;
- legal/compliance policy;
- production deployment authorization.

Adaptive intelligence operates **inside** the trust and policy envelope.

## Next implementation layers

### Layer 1 — observation memory

Persist structured state snapshots and action outcomes.

### Layer 2 — counterfactual evaluation

Before executing a strategy, estimate:

- expected gain;
- expected failure;
- cost;
- latency;
- risk.

### Layer 3 — online policy learning

Compare predicted versus observed outcomes and continuously recalibrate.

### Layer 4 — adversarial self-evaluation

Generate competing plans and attempt to falsify the preferred strategy before execution.

### Layer 5 — distributed agent consensus

Have independent agents produce:

- proposal;
- evidence;
- critique;
- counterproposal;
- final policy decision.

### Layer 6 — meta-learning

Track which reasoning strategies work best for which classes of problems and
select the strategy before selecting the underlying action.

## Current boundary

The kernel is a foundation for measurable adaptation.

It does not constitute evidence that AuthiChain has achieved superintelligence.
