"""
agentz.core.launch_score
-------------------------
The Launch Score — a single continuously-calculated number that tells
the Governor where AuthiChain stands and what the bottleneck is.

Launch Score = weighted sum of seven dimensions:

    20% Protocol readiness
    20% Production reliability
    15% Security/compliance
    15% Customer readiness
    15% Revenue traction
    10% Acquisition efficiency
     5% Operational automation

Each dimension is scored 0-100. The weights are fixed by the launch
thesis: protocol integrity and production reliability are the foundation,
and you can't scale acquisition until customers and revenue are real.

The score is designed to prevent the most common autonomous failure:
generating thousands of leads for a product that isn't ready.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("agentz.launch_score")


# ── Dimension weights (must sum to 100) ─────────────────────────────────────

DIMENSION_WEIGHTS = {
    "protocol":      20,
    "production":    20,
    "security":      15,
    "customer":      15,
    "revenue":       15,
    "acquisition":   10,
    "automation":     5,
}

assert sum(DIMENSION_WEIGHTS.values()) == 100, "Weights must sum to 100"


@dataclass
class DimensionScore:
    """A single dimension's score and the evidence behind it."""
    name: str
    weight: int
    score: float = 0.0          # 0-100
    evidence: str = ""
    sub_metrics: dict[str, float] = field(default_factory=dict)


@dataclass
class LaunchScore:
    """The composite launch score and its breakdown."""
    total: float = 0.0         # 0-100
    dimensions: dict[str, DimensionScore] = field(default_factory=dict)
    bottleneck: str = ""
    recommended_action: str = ""
    calculated_at: str = ""
    stage: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "total": round(self.total, 1),
            "stage": self.stage,
            "bottleneck": self.bottleneck,
            "recommended_action": self.recommended_action,
            "calculated_at": self.calculated_at,
            "dimensions": {
                name: asdict(dim) for name, dim in self.dimensions.items()
            },
        }

    def summary(self) -> str:
        lines = [f"Launch Score: {self.total:.0f}  (stage: {self.stage})"]
        lines.append("-" * 40)
        for name, dim in self.dimensions.items():
            bar = "█" * int(dim.score / 10) + "░" * (10 - int(dim.score / 10))
            lines.append(f"  {name:14s} {bar} {dim.score:3.0f}% (×{dim.weight}%)")
        lines.append("-" * 40)
        if self.bottleneck:
            lines.append(f"  Bottleneck: {self.bottleneck}")
        if self.recommended_action:
            lines.append(f"  Recommended: {self.recommended_action}")
        return "\n".join(lines)


# ── Scoring Functions ──────────────────────────────────────────────────────


def _score_protocol(ctx: Optional[dict]) -> DimensionScore:
    """Protocol readiness: attestation, verification, conformance."""
    dim = DimensionScore(name="protocol", weight=DIMENSION_WEIGHTS["protocol"])
    if not ctx:
        dim.score = 50.0
        dim.evidence = "no context — using baseline"
        return dim

    subs: dict[str, float] = {}
    subs["schema_conformance"] = 100.0 if ctx.get("protocol_schema_pass") else 0.0
    subs["signature_verify"] = 100.0 if ctx.get("protocol_signature_pass") else 50.0
    subs["negative_fixtures"] = 100.0 if ctx.get("protocol_negative_pass") else 0.0
    subs["deterministic_verifier"] = 100.0 if ctx.get("protocol_deterministic") else 80.0

    dim.sub_metrics = subs
    dim.score = sum(subs.values()) / len(subs) if subs else 0.0
    dim.evidence = f"conformance={subs.get('schema_conformance', 0):.0f}, " \
                   f"sig={subs.get('signature_verify', 0):.0f}, " \
                   f"neg={subs.get('negative_fixtures', 0):.0f}"
    return dim


def _score_production(ctx: Optional[dict]) -> DimensionScore:
    """Production reliability: deployment, DB, observability, rollback."""
    dim = DimensionScore(name="production", weight=DIMENSION_WEIGHTS["production"])
    if not ctx:
        dim.score = 50.0
        dim.evidence = "no context — using baseline"
        return dim

    subs: dict[str, float] = {}
    subs["deployment_healthy"] = 100.0 if ctx.get("deployment_healthy") else 0.0
    subs["db_migrations_clean"] = 100.0 if ctx.get("db_migrations_clean") else 60.0
    subs["secrets_present"] = 100.0 if ctx.get("secrets_present") else 0.0
    subs["observability_active"] = 100.0 if ctx.get("observability_active") else 30.0
    subs["rollback_tested"] = 100.0 if ctx.get("rollback_tested") else 50.0

    dim.sub_metrics = subs
    dim.score = sum(subs.values()) / len(subs) if subs else 0.0
    dim.evidence = f"deploy={subs.get('deployment_healthy', 0):.0f}, " \
                   f"db={subs.get('db_migrations_clean', 0):.0f}, " \
                   f"obs={subs.get('observability_active', 0):.0f}"
    return dim


def _score_security(ctx: Optional[dict]) -> DimensionScore:
    """Security and compliance: DPP compliance, fraud alerts, credential health."""
    dim = DimensionScore(name="security", weight=DIMENSION_WEIGHTS["security"])
    if not ctx:
        dim.score = 50.0
        dim.evidence = "no context — using baseline"
        return dim

    subs: dict[str, float] = {}
    subs["dpp_compliance"] = float(ctx.get("dpp_compliance_score", 80.0))
    subs["fraud_alerts"] = max(0.0, 100.0 - ctx.get("fraud_alert_count", 0) * 10.0)
    subs["credential_health"] = 100.0 if ctx.get("credentials_valid") else 70.0
    subs["no_protocol_violations"] = 100.0 if not ctx.get("protocol_violations") else 0.0

    dim.sub_metrics = subs
    dim.score = sum(subs.values()) / len(subs) if subs else 0.0
    dim.evidence = f"dpp={subs.get('dpp_compliance', 0):.0f}, " \
                   f"fraud={subs.get('fraud_alerts', 0):.0f}, " \
                   f"creds={subs.get('credential_health', 0):.0f}"
    return dim


def _score_customer(ctx: Optional[dict]) -> DimensionScore:
    """Customer readiness: pilots, onboarding, end-to-end verification."""
    dim = DimensionScore(name="customer", weight=DIMENSION_WEIGHTS["customer"])
    if not ctx:
        dim.score = 50.0
        dim.evidence = "no context — using baseline"
        return dim

    subs: dict[str, float] = {}
    active_pilots = ctx.get("active_pilots", 0)
    subs["pilot_count"] = min(100.0, active_pilots / 3.0 * 100.0)
    subs["e2e_verification"] = 100.0 if ctx.get("e2e_verification_works") else 40.0
    subs["onboarding_exists"] = 100.0 if ctx.get("onboarding_documented") else 20.0
    subs["support_runbook"] = 100.0 if ctx.get("support_runbook") else 10.0

    dim.sub_metrics = subs
    dim.score = sum(subs.values()) / len(subs) if subs else 0.0
    dim.evidence = f"pilots={active_pilots}, " \
                   f"e2e={subs.get('e2e_verification', 0):.0f}, " \
                   f"onboard={subs.get('onboarding_exists', 0):.0f}"
    return dim


def _score_revenue(ctx: Optional[dict]) -> DimensionScore:
    """Revenue traction: paying customers, revenue recorded, product usage."""
    dim = DimensionScore(name="revenue", weight=DIMENSION_WEIGHTS["revenue"])
    if not ctx:
        dim.score = 50.0
        dim.evidence = "no context — using baseline"
        return dim

    subs: dict[str, float] = {}
    paying = ctx.get("paying_customers", 0)
    subs["paying_customers"] = min(100.0, paying / 3.0 * 100.0)
    subs["revenue_recorded"] = 100.0 if ctx.get("first_revenue_recorded") else 0.0
    subs["product_usage"] = float(ctx.get("product_usage_score", 30.0))
    subs["customer_outcome"] = 100.0 if ctx.get("customer_outcome_captured") else 20.0

    dim.sub_metrics = subs
    dim.score = sum(subs.values()) / len(subs) if subs else 0.0
    dim.evidence = f"paying={paying}, " \
                   f"rev_recorded={subs.get('revenue_recorded', 0):.0f}, " \
                   f"usage={subs.get('product_usage', 0):.0f}"
    return dim


def _score_acquisition(ctx: Optional[dict]) -> DimensionScore:
    """Acquisition efficiency: prospects, demos, conversion rates."""
    dim = DimensionScore(name="acquisition", weight=DIMENSION_WEIGHTS["acquisition"])
    if not ctx:
        dim.score = 50.0
        dim.evidence = "no context — using baseline"
        return dim

    subs: dict[str, float] = {}
    prospects = ctx.get("qualified_prospects", 0)
    subs["prospect_pipeline"] = min(100.0, prospects / 50.0 * 100.0)
    demos = ctx.get("demos_completed", 0)
    subs["demo_conversion"] = min(100.0, demos / 20.0 * 100.0)
    pilot_rate = ctx.get("pilot_conversion_rate", 0.0)
    subs["pilot_conversion"] = min(100.0, pilot_rate * 100.0)
    subs["outbound_quality"] = 100.0 if ctx.get("outbound_quality_established") else 30.0

    dim.sub_metrics = subs
    dim.score = sum(subs.values()) / len(subs) if subs else 0.0
    dim.evidence = f"prospects={prospects}, " \
                   f"demos={demos}, " \
                   f"pilot_rate={pilot_rate:.0%}"
    return dim


def _score_automation(ctx: Optional[dict]) -> DimensionScore:
    """Operational automation: how much of the loop runs without humans."""
    dim = DimensionScore(name="automation", weight=DIMENSION_WEIGHTS["automation"])
    if not ctx:
        dim.score = 50.0
        dim.evidence = "no context — using baseline"
        return dim

    subs: dict[str, float] = {}
    total_workflows = ctx.get("total_workflows", 1)
    auto_workflows = ctx.get("auto_executable_workflows", 0)
    subs["auto_ratio"] = (auto_workflows / total_workflows * 100.0) if total_workflows > 0 else 0.0
    subs["governor_active"] = 100.0 if ctx.get("governor_running") else 0.0
    subs["incident_response_time"] = float(ctx.get("incident_response_score", 50.0))
    subs["healer_active"] = 100.0 if ctx.get("healer_running") else 0.0

    dim.sub_metrics = subs
    dim.score = sum(subs.values()) / len(subs) if subs else 0.0
    dim.evidence = f"auto={subs.get('auto_ratio', 0):.0f}%, " \
                   f"governor={subs.get('governor_active', 0):.0f}, " \
                   f"healer={subs.get('healer_active', 0):.0f}"
    return dim


SCORERS = {
    "protocol": _score_protocol,
    "production": _score_production,
    "security": _score_security,
    "customer": _score_customer,
    "revenue": _score_revenue,
    "acquisition": _score_acquisition,
    "automation": _score_automation,
}


def calculate_launch_score(
    context: Optional[dict] = None,
    stage: str = "BOOT",
) -> LaunchScore:
    """
    Calculate the Launch Score from the current operational context.

    The context dict should contain keys like:
        protocol_schema_pass, deployment_healthy, active_pilots,
        paying_customers, qualified_prospects, etc.

    If context is None, all dimensions get a neutral baseline (50).
    """
    score = LaunchScore(
        calculated_at=datetime.now(timezone.utc).isoformat(),
        stage=stage,
    )

    for name, scorer in SCORERS.items():
        dim = scorer(context)
        score.dimensions[name] = dim

    # Weighted total
    total = 0.0
    for name, dim in score.dimensions.items():
        total += (dim.score * dim.weight) / 100.0
    score.total = total

    # Identify bottleneck (lowest weighted contribution)
    lowest_name = min(score.dimensions, key=lambda k: score.dimensions[k].score)
    lowest = score.dimensions[lowest_name]
    score.bottleneck = f"{lowest_name} ({lowest.score:.0f}%)"

    # Recommended action based on bottleneck
    score.recommended_action = _recommend_action(lowest_name, lowest.score, stage)

    return score


def _recommend_action(bottleneck: str, score: float, stage: str) -> str:
    """Generate a recommended action based on the bottleneck dimension."""
    recommendations = {
        "protocol": "Run protocol conformance tests and fix failing fixtures before any acquisition activity.",
        "production": "Fix deployment, DB migrations, or observability gaps. Do not launch beta until production is stable.",
        "security": "Resolve compliance gaps, fraud alerts, or credential issues. ProtocolGuardian should investigate.",
        "customer": "Automate merchant onboarding and deploy self-service verification walkthrough.",
        "revenue": "Focus on converting pilots to paid. Do not scale acquisition until revenue is proven.",
        "acquisition": "Do not increase outbound volume. Outbound quality threshold not yet established.",
        "automation": "Increase the fraction of workflows that can run safely in AUTO mode.",
    }
    return recommendations.get(bottleneck, "Review the launch score breakdown for details.")


# ── Score history persistence ──────────────────────────────────────────────

SCORE_HISTORY_FILE = Path(__file__).resolve().parents[1] / "logs" / "launch_scores.jsonl"


def persist_score(score: LaunchScore, path: Path = SCORE_HISTORY_FILE) -> None:
    """Append the score to the history file for trend analysis."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(score.to_dict()) + "\n")
