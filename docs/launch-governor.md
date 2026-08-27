# Launch Governor

## Overview

The Launch Governor turns AgentZ from a collection of autonomous agents into a
**directed launch operating system**. It owns the state machine and budget, runs
six specialist agents through the existing registry/runner, and optimizes for a
constrained objective: **reach 3 active paying pilot customers without
compromising protocol integrity.**

AuthiChain remains the product. AgentZ becomes the operating system that launches
and scales it.

## Architecture

```
                    ┌────────────────────────┐
                    │    LAUNCH GOVERNOR     │
                    │     AgentZ Supervisor  │
                    └───────────┬────────────┘
                                │
       ┌────────────┬───────────┼───────────┬────────────┐
       ▼            ▼           ▼           ▼            ▼
   PROTOCOL      PRODUCT      GROWTH       SALES       SRE/TRUST
   Guardian      Builder      Scout        Closer      Healer
       │            │           │           │            │
       └────────────┴───────────┼───────────┴────────────┘
                                ▼
                         DECISION ENGINE
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
          AUTO EXECUTE                         ESCALATE
```

The Governor is NOT a second autonomous framework. It's an evolution of the existing
AgentZ substrate — registry-driven runner, dependency resolution, dry-run/confirm/auto
modes, credential preflight, retries, rate limits, notifications, and audit logging.

## The Launch State Machine

```
BOOT
  ↓
PROTOCOL_READY
  ↓
REFERENCE_IMPLEMENTATION_READY
  ↓
PRODUCTION_READY
  ↓
BETA_READY
  ↓
3_PILOTS
  ↓
FIRST_REVENUE
  ↓
REPEATABLE_ACQUISITION
  ↓
SCALE
```

Every transition has measurable gates. The state machine persists to
`agentz/logs/launch_state.json` and advances only when all gates pass.

### Gate Examples

**PROTOCOL_READY**
- attestation schema passes conformance tests
- signature fixture validates
- negative fixtures fail correctly
- verifier produces deterministic results
- key/status semantics documented

**PRODUCTION_READY**
- deployment healthy
- DB migrations clean
- secrets present
- observability active
- rollback tested
- verification API monitored

**BETA_READY**
- registration → attestation → QR → verification works end-to-end
- evidence page works
- customer onboarding exists
- support/runbook exists

**FIRST_REVENUE**
- at least one real business is paying
- payment event recorded
- product usage recorded
- customer outcome captured

## The Six Specialist Agents

### 1. ProtocolGuardian (`agentz/core/specialists.py`)
Owns the trust layer. Has **veto power**.

Checks: schema validation, conformance testing, signature verification, key/JWKS
health, revocation/status checks, negative fixtures, protocol documentation drift.

**Never autonomously writes protocol semantics without escalation.**

### 2. LaunchBuilder
Owns engineering execution. Maps onto the existing runner/registry.

Can auto-fix: lint, formatting, broken tests with obvious fixes, configuration drift,
documentation, CI failures.

Requires approval for: production secrets, DB destruction, protocol changes, billing
changes, security-policy changes, irreversible infrastructure changes.

### 3. GrowthScout
The acquisition engine. Searches for manufacturers, distributors, product
authentication problems, counterfeit/fraud pain, product-passport initiatives,
supply-chain digitization, partnership opportunities.

Scores prospects on a 100-point rubric:

| Factor | Max |
|--------|-----|
| ICP fit | 25 |
| Pain intensity | 20 |
| AuthiChain fit | 20 |
| Buying authority | 15 |
| Deployment ease | 10 |
| Revenue potential | 10 |
| **TOTAL** | **100** |

Only prospects above 60 enter outreach.

### 4. PilotCloser
Owns the conversion funnel: Prospect → Qualified → Discovery → Demo → Pilot
proposal → Pilot active → Paid → Expansion.

Objective: create the smallest possible path from qualified prospect to real
authenticated products in production.

Outbound communication is **approval-gated** until messaging, compliance, and
deliverability are proven.

### 5. RevenueOperator
Owns economics. Tracks CAC, conversion rates, revenue/product, revenue/scan,
revenue/customer, gross margin, API/AI/infra costs.

Continuously answers: **Where should the next dollar of effort go?**

### 6. TrustHealer
Strongest operational privileges after ProtocolGuardian. Watches for failed
verification, abnormal scan patterns, copied QR behavior, suspicious geographic
patterns, API errors, latency, authentication failures, deployment failures,
credential expiration, data anomalies.

Can auto: retry, restart, roll back, disable bad workflow, quarantine suspicious
records, notify, open incident.

## The Launch Score

```
Launch Score =
  20% Protocol readiness
  20% Production reliability
  15% Security/compliance
  15% Customer readiness
  15% Revenue traction
  10% Acquisition efficiency
   5% Operational automation
```

Example:
```
Protocol       ██████████ 98%
Production     █████████░ 92%
Security       █████████░ 88%
Customers      ██████░░░░ 64%
Revenue        ██░░░░░░░░ 21%
Growth         ████░░░░░░ 37%
Automation     ████████░░ 81%
──────────────────────────────
Launch Score   72

Bottleneck: revenue (21%)
Recommended: Focus on converting pilots to paid.
             Do not scale acquisition until revenue is proven.
```

This prevents the common failure mode where an autonomous system generates
thousands of leads for a product that isn't ready.

## Capital & Reputation Firewall

Every workflow carries a risk classification:

```yaml
id: launch_send_followups
priority: medium
type: growth
risk_class: medium
financial_limit_usd: 25
reputational_impact: high
requires_human_approval: true
max_runs_per_day: 100
```

```yaml
id: auto_fix_ci
priority: high
type: engineering
risk_class: low
financial_limit_usd: 0
reputational_impact: low
requires_human_approval: false
max_runs_per_day: 20
```

The firewall enforces:
- **Approval gating**: HIGH/CRITICAL risk workflows always require CONFIRM mode,
  even in AUTO
- **Budget enforcement**: cumulative spend per workflow per day cannot exceed
  `financial_limit_usd`
- **Veto enforcement**: ProtocolGuardian can block protocol-touching workflows

## Autonomous Loop

```
OBSERVE
   ↓
MEASURE
   ↓
IDENTIFY BOTTLENECK
   ↓
GENERATE ACTIONS
   ↓
RISK SCORE
   ↓
EXECUTE SAFE ACTION
   ↓
VERIFY OUTCOME
   ↓
RECORD RESULT
   ↓
UPDATE PRIORITIES
   ↓
REPEAT
```

Every action has: objective, preconditions, expected outcome, risk, budget,
rollback, verification.

## Constrained Objective

```
PRIMARY OBJECTIVE:
  Reach 3 active paying AuthiChain pilot customers.

SECONDARY:
  Increase verified products under protection.

CONSTRAINTS:
  - Never weaken protocol verification.
  - Never expose secrets.
  - Never alter protocol semantics autonomously.
  - Never spend above daily budget.
  - Never send high-impact external communication without approval
    until outbound quality threshold is established.
  - Preserve complete audit trail.

OPTIMIZATION:
  Minimize time and cost to first recurring revenue.
```

## Daily Autonomous Cadence

| Frequency | Activity |
|-----------|----------|
| Every few minutes | Health + verification monitoring |
| Every hour | Pipeline, product telemetry, incidents, deployment state |
| Every 6 hours | Prospect discovery and scoring |
| Daily | Launch score + bottleneck analysis + safe execution |
| Weekly | Economic review: what generated revenue, what should be stopped/doubled |

## Usage

### Run a Governor cycle (dry-run — safe)

```bash
python -m agentz.core.governor --mode dry-run
```

### Run with a specific daily budget

```bash
python -m agentz.core.governor --mode auto --budget 50
```

### Via the workflow registry

```bash
python -m agentz.cli run launch_governor --mode dry-run
```

### Via the API

```bash
# Get current launch state
curl -H "Authorization: Bearer $AGENT_SECRET" \
  http://localhost:8000/launch/state

# Get Launch Score
curl -H "Authorization: Bearer $AGENT_SECRET" \
  http://localhost:8000/launch/score

# Run a Governor cycle
curl -X POST -H "Authorization: Bearer $AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode": "dry-run", "budget": 50}' \
  http://localhost:8000/launch/governor/cycle

# Get specialist status
curl -H "Authorization: Bearer $AGENT_SECRET" \
  http://localhost:8000/launch/specialists
```

## File Structure

```
agentz/core/
  governor.py          # LaunchGovernor — the executive controller
  launch_state.py      # State machine (9 stages + gates)
  launch_score.py      # Launch Score (7 weighted dimensions)
  specialists.py       # Six specialist agent roles
  risk_firewall.py     # Capital & Reputation Firewall
  runner.py            # Extended with risk_class, financial_limit_usd, etc.
  modes.py             # Unchanged (Mode, ExecutionContext)

agentz/workflows/handlers/launch/
  __init__.py
  governor.py          # launch_governor handler
  observe.py           # launch_observe
  score.py             # launch_score
  bottleneck.py        # launch_bottleneck
  protocol_gate.py     # launch_protocol_gate
  production_gate.py   # launch_production_gate
  beta_gate.py         # launch_beta_gate
  find_prospects.py    # launch_find_prospects
  score_prospects.py   # launch_score_prospects
  prepare_outreach.py  # launch_prepare_outreach
  followup.py          # launch_followup
  onboard_pilot.py     # launch_onboard_pilot
  measure_pilot.py     # launch_measure_pilot
  convert_paid.py      # launch_convert_paid
  revenue_review.py    # launch_revenue_review
  incident_response.py # launch_incident_response
  daily_report.py      # launch_daily_report
  weekly_strategy.py   # launch_weekly_strategy

agentz/workflows/registry.yaml    # +18 launch workflows with firewall fields
agentz/api/main.py                # +5 launch API endpoints
agentz/logs/
  launch_state.json   # State machine persistence
  launch_scores.jsonl # Score history
  governor_cycles.jsonl # Cycle records
```
