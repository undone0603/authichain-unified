"""
agentz.core.si_adaptation
-------------------------
Measured adaptation kernel for AuthiChain's SI-oriented control loop.

This module does not claim superintelligence. It provides an explicit,
auditable mechanism for improving decision selection from observed outcomes.

Loop:
    OBSERVE -> HYPOTHESIZE -> SCORE OPTIONS -> ACT -> MEASURE -> UPDATE

Design goals:
- deterministic scoring for reproducibility;
- learning from historical outcomes;
- risk/cost/latency awareness;
- confidence calibration;
- no hidden state outside explicit records;
- compatible with Governor / Architect context dictionaries.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from math import sqrt, log
from typing import Any, Iterable


@dataclass(frozen=True)
class AdaptationOutcome:
    action_id: str
    baseline_score: float
    outcome_score: float
    cost_usd: float = 0.0
    latency_s: float = 0.0
    risk: float = 0.0
    success: bool = True

    @property
    def delta(self) -> float:
        return self.outcome_score - self.baseline_score


@dataclass
class ActionProfile:
    action_id: str
    trials: int = 0
    successes: int = 0
    mean_delta: float = 0.0
    mean_cost: float = 0.0
    mean_latency_s: float = 0.0
    mean_risk: float = 0.0

    @property
    def success_rate(self) -> float:
        return self.successes / self.trials if self.trials else 0.0


@dataclass(frozen=True)
class AdaptationCandidate:
    action_id: str
    expected_gain: float
    confidence: float
    exploration_bonus: float
    cost_penalty: float
    latency_penalty: float
    risk_penalty: float
    utility: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AdaptationMemory:
    """Small explicit memory of observed action outcomes."""

    def __init__(self) -> None:
        self._profiles: dict[str, ActionProfile] = {}

    def profile(self, action_id: str) -> ActionProfile:
        if action_id not in self._profiles:
            self._profiles[action_id] = ActionProfile(action_id=action_id)
        return self._profiles[action_id]

    def observe(self, outcome: AdaptationOutcome) -> ActionProfile:
        p = self.profile(outcome.action_id)
        p.trials += 1
        p.successes += 1 if outcome.success else 0
        n = p.trials
        p.mean_delta += (outcome.delta - p.mean_delta) / n
        p.mean_cost += (outcome.cost_usd - p.mean_cost) / n
        p.mean_latency_s += (outcome.latency_s - p.mean_latency_s) / n
        p.mean_risk += (outcome.risk - p.mean_risk) / n
        return p

    def snapshot(self) -> dict[str, dict[str, Any]]:
        return {key: asdict(value) for key, value in self._profiles.items()}


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def rank_candidates(
    candidates: Iterable[dict[str, Any]],
    memory: AdaptationMemory,
    *,
    total_trials: int | None = None,
    exploration_weight: float = 0.25,
    cost_weight: float = 0.02,
    latency_weight: float = 0.002,
    risk_weight: float = 1.0,
) -> list[AdaptationCandidate]:
    """
    Rank candidate actions using measured historical performance.

    Candidate fields:
      action_id: required stable identifier
      estimated_gain: expected score improvement if supplied
      cost_usd: estimated cost
      latency_s: estimated latency
      risk: normalized 0..1 risk estimate
      confidence: prior confidence 0..1

    Historical evidence adds an upper-confidence exploration term. This is
    intentionally simple and explainable rather than model-specific.
    """
    items = list(candidates)
    if not items:
        return []

    observed_total = total_trials
    if observed_total is None:
        observed_total = sum(memory.profile(str(item["action_id"])).trials for item in items)
    observed_total = max(observed_total, 1)

    ranked: list[AdaptationCandidate] = []
    for item in items:
        action_id = str(item["action_id"])
        p = memory.profile(action_id)

        estimated_gain = float(item.get("estimated_gain", 0.0))
        prior_conf = _clip(float(item.get("confidence", 0.5)), 0.0, 1.0)
        cost = max(0.0, float(item.get("cost_usd", 0.0)))
        latency = max(0.0, float(item.get("latency_s", 0.0)))
        risk = _clip(float(item.get("risk", 0.0)), 0.0, 1.0)

        # Blend model/heuristic prior with measured historical gain.
        if p.trials:
            confidence = _clip((prior_conf + p.success_rate) / 2.0, 0.0, 1.0)
            expected_gain = (estimated_gain + p.mean_delta) / 2.0
        else:
            confidence = prior_conf
            expected_gain = estimated_gain

        exploration = exploration_weight * sqrt(log(observed_total + 1.0) / (p.trials + 1.0))
        cost_penalty = cost_weight * cost
        latency_penalty = latency_weight * latency
        risk_penalty = risk_weight * risk * (1.0 + (1.0 - confidence))

        utility = (
            expected_gain * (0.5 + confidence)
            + exploration
            - cost_penalty
            - latency_penalty
            - risk_penalty
        )

        ranked.append(
            AdaptationCandidate(
                action_id=action_id,
                expected_gain=expected_gain,
                confidence=confidence,
                exploration_bonus=exploration,
                cost_penalty=cost_penalty,
                latency_penalty=latency_penalty,
                risk_penalty=risk_penalty,
                utility=utility,
            )
        )

    return sorted(ranked, key=lambda item: (-item.utility, item.action_id))


def choose_next_action(
    candidates: Iterable[dict[str, Any]],
    memory: AdaptationMemory,
    **kwargs: Any,
) -> AdaptationCandidate | None:
    ranked = rank_candidates(candidates, memory, **kwargs)
    return ranked[0] if ranked else None


def evaluate_adaptation(
    before_score: float,
    after_score: float,
    *,
    cost_usd: float = 0.0,
    latency_s: float = 0.0,
    risk: float = 0.0,
) -> AdaptationOutcome:
    """Convert an observed state transition into reusable learning evidence."""
    return AdaptationOutcome(
        action_id="unassigned",
        baseline_score=before_score,
        outcome_score=after_score,
        cost_usd=cost_usd,
        latency_s=latency_s,
        risk=_clip(risk, 0.0, 1.0),
        success=after_score >= before_score,
    )
