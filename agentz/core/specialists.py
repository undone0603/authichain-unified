"""
agentz.core.specialists
-----------------------
The six specialist agents of the Launch Governor.

These are NOT independent autonomous agents freelancing. They are roles
owned by the Governor. Each role wraps an existing AgentZ module and
provides a consistent interface for the Governor to call through the
registry/runner system.

Roles:
  1. ProtocolGuardian  — owns trust layer, has veto power
  2. LaunchBuilder     — owns engineering execution
  3. GrowthScout       — owns acquisition/discovery
  4. PilotCloser       — owns conversion funnel
  5. RevenueOperator   — owns economics/budget allocation
  6. TrustHealer       — owns operational integrity, can auto-remediate

Each role returns a SpecialistResult with findings, recommended actions,
and whether it exercised veto power.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger("agentz.specialists")


@dataclass
class SpecialistResult:
    """Return value from a specialist agent's assessment."""
    role: str
    healthy: bool = True
    findings: list[str] = field(default_factory=list)
    recommended_actions: list[dict[str, Any]] = field(default_factory=list)
    veto: bool = False
    veto_reason: str = ""
    metrics: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> str:
        lines = [f"[{self.role}] {'HEALTHY' if self.healthy else 'ISSUES'}"]
        if self.veto:
            lines.append(f"  VETO: {self.veto_reason}")
        for f in self.findings:
            lines.append(f"  - {f}")
        for a in self.recommended_actions:
            lines.append(f"  → {a.get('workflow_id', '?')}: {a.get('reason', '')}")
        return "\n".join(lines)


# ── 1. ProtocolGuardian ─────────────────────────────────────────────────────


class ProtocolGuardian:
    """
    Owns the trust layer. Has veto power.

    Checks:
      - Schema validation
      - Conformance testing
      - Signature verification
      - Key/JWKS health
      - Revocation/status checks
      - Negative fixtures
      - Protocol documentation drift

    Never autonomously writes protocol semantics without escalation.
    """

    ROLE = "ProtocolGuardian"

    def assess(self, ctx: Optional[dict] = None) -> SpecialistResult:
        result = SpecialistResult(role=self.ROLE)
        ctx = ctx or {}

        # These would run actual checks in production
        if not ctx.get("protocol_schema_pass", True):
            result.healthy = False
            result.findings.append("Schema conformance tests failing")
            result.recommended_actions.append({
                "workflow_id": "launch_protocol_gate",
                "reason": "fix failing schema conformance tests",
            })

        if not ctx.get("protocol_signature_pass", True):
            result.healthy = False
            result.findings.append("Signature verification failing on fixtures")
            result.recommended_actions.append({
                "workflow_id": "launch_protocol_gate",
                "reason": "fix signature verification",
            })

        if ctx.get("protocol_violations"):
            result.healthy = False
            result.veto = True
            result.veto_reason = "Protocol integrity violations detected — all protocol changes blocked"
            result.findings.append(f"{len(ctx['protocol_violations'])} protocol violations")

        result.metrics = {
            "schema_pass": ctx.get("protocol_schema_pass", True),
            "signature_pass": ctx.get("protocol_signature_pass", True),
            "violations": len(ctx.get("protocol_violations", [])),
        }
        return result


# ── 2. LaunchBuilder ─────────────────────────────────────────────────────────


class LaunchBuilder:
    """
    Owns engineering execution.

    Can automatically fix:
      - lint, formatting, broken tests with obvious/local fixes
      - configuration drift, documentation, CI failures

    Requires approval for:
      - production secrets, DB destruction, protocol changes
      - billing changes, security-policy changes, irreversible infra
    """

    ROLE = "LaunchBuilder"

    def assess(self, ctx: Optional[dict] = None) -> SpecialistResult:
        result = SpecialistResult(role=self.ROLE)
        ctx = ctx or {}

        open_issues = ctx.get("open_github_issues", 0)
        failing_tests = ctx.get("failing_tests", 0)
        ci_failing = ctx.get("ci_failing", False)

        if open_issues > 0:
            result.findings.append(f"{open_issues} open GitHub issues")
            result.recommended_actions.append({
                "workflow_id": "launch_production_gate",
                "reason": f"review and triage {open_issues} open issues",
            })

        if failing_tests > 0:
            result.healthy = False
            result.findings.append(f"{failing_tests} failing tests")
            result.recommended_actions.append({
                "workflow_id": "launch_production_gate",
                "reason": f"fix {failing_tests} failing tests",
            })

        if ci_failing:
            result.healthy = False
            result.findings.append("CI is failing")
            result.recommended_actions.append({
                "workflow_id": "launch_production_gate",
                "reason": "fix CI failures (auto-fix if local/obvious)",
            })

        result.metrics = {
            "open_issues": open_issues,
            "failing_tests": failing_tests,
            "ci_status": "failing" if ci_failing else "passing",
        }
        return result


# ── 3. GrowthScout ───────────────────────────────────────────────────────────


class GrowthScout:
    """
    The acquisition engine. Continuously searches for manufacturers,
    distributors, product authentication problems, and partnership
    opportunities. Scores prospects on a 100-point scale.

    Only prospects above threshold enter outreach.
    """

    ROLE = "GrowthScout"

    SCORING_RUBRIC = {
        "icp_fit": 25,
        "pain_intensity": 20,
        "authichain_fit": 20,
        "buying_authority": 15,
        "deployment_ease": 10,
        "revenue_potential": 10,
    }

    PROSPECT_THRESHOLD = 60  # minimum score to enter outreach

    def assess(self, ctx: Optional[dict] = None) -> SpecialistResult:
        result = SpecialistResult(role=self.ROLE)
        ctx = ctx or {}

        prospects = ctx.get("qualified_prospects", 0)
        new_prospects = ctx.get("new_prospects", 0)

        if new_prospects > 0:
            result.findings.append(f"{new_prospects} new prospects discovered")
            result.recommended_actions.append({
                "workflow_id": "launch_score_prospects",
                "reason": f"score {new_prospects} new prospects",
            })

        if prospects < 10 and ctx.get("stage", "") not in ("BOOT", "PROTOCOL_READY"):
            result.findings.append(f"Only {prospects} qualified prospects — need more discovery")
            result.recommended_actions.append({
                "workflow_id": "launch_find_prospects",
                "reason": "prospect pipeline below threshold",
            })

        result.metrics = {
            "qualified_prospects": prospects,
            "new_prospects": new_prospects,
            "threshold": self.PROSPECT_THRESHOLD,
        }
        return result

    @staticmethod
    def score_prospect(
        icp_fit: int,
        pain_intensity: int,
        authichain_fit: int,
        buying_authority: int,
        deployment_ease: int,
        revenue_potential: int,
    ) -> int:
        """Score a prospect 0-100 using the six-factor rubric."""
        return (
            min(25, icp_fit)
            + min(20, pain_intensity)
            + min(20, authichain_fit)
            + min(15, buying_authority)
            + min(10, deployment_ease)
            + min(10, revenue_potential)
        )


# ── 4. PilotCloser ───────────────────────────────────────────────────────────


class PilotCloser:
    """
    Owns the conversion funnel:
      Prospect → Qualified → Discovery → Demo → Pilot proposal →
      Pilot active → Paid → Expansion

    Objective: create the smallest possible path from qualified prospect
    to real authenticated products in production.

    Outbound communication is approval-gated until messaging, compliance,
    and deliverability are proven.
    """

    ROLE = "PilotCloser"

    FUNNEL_STAGES = [
        "prospect", "qualified", "discovery", "demo",
        "pilot_proposal", "pilot_active", "paid", "expansion",
    ]

    def assess(self, ctx: Optional[dict] = None) -> SpecialistResult:
        result = SpecialistResult(role=self.ROLE)
        ctx = ctx or {}

        pipeline = ctx.get("pipeline", {})
        for stage in self.FUNNEL_STAGES:
            count = pipeline.get(stage, 0)
            result.metrics[stage] = count

        demos = pipeline.get("demo", 0)
        pilots = pipeline.get("pilot_active", 0)
        paying = pipeline.get("paid", 0)
        followups_needed = ctx.get("followups_needed", 0)

        if followups_needed > 0:
            result.findings.append(f"{followups_needed} follow-ups needed")
            result.recommended_actions.append({
                "workflow_id": "launch_followup",
                "reason": f"send {followups_needed} follow-ups (approval-gated)",
            })

        if demos > 0 and pilots == 0:
            result.healthy = False
            result.findings.append(f"{demos} demos completed but 0 pilots — conversion gap")
            result.recommended_actions.append({
                "workflow_id": "launch_onboard_pilot",
                "reason": "convert demos to pilots",
            })

        if pilots > 0 and paying == 0:
            result.findings.append(f"{pilots} active pilots but 0 paying — revenue gap")
            result.recommended_actions.append({
                "workflow_id": "launch_convert_paid",
                "reason": "convert pilots to paid",
            })

        return result


# ── 5. RevenueOperator ────────────────────────────────────────────────────────


class RevenueOperator:
    """
    Owns economics. Tracks CAC, conversion rates, revenue/product,
    revenue/scan, gross margin, API/AI/infra costs.

    Continuously answers: Where should the next dollar of effort go?
    """

    ROLE = "RevenueOperator"

    def assess(self, ctx: Optional[dict] = None) -> SpecialistResult:
        result = SpecialistResult(role=self.ROLE)
        ctx = ctx or {}

        metrics = {
            "cac": ctx.get("cac", 0.0),
            "revenue_mtd": ctx.get("revenue_mtd", 0.0),
            "pilot_to_paid_rate": ctx.get("pilot_to_paid_rate", 0.0),
            "gross_margin": ctx.get("gross_margin", 0.0),
            "ai_cost_mtd": ctx.get("ai_cost_mtd", 0.0),
            "infra_cost_mtd": ctx.get("infra_cost_mtd", 0.0),
        }
        result.metrics = metrics

        # Budget allocation recommendation
        stage = ctx.get("stage", "BOOT")
        if stage in ("BOOT", "PROTOCOL_READY", "REFERENCE_IMPLEMENTATION_READY"):
            result.findings.append("Pre-revenue: all effort on protocol + production")
            result.recommended_actions.append({
                "workflow_id": "launch_revenue_review",
                "reason": "0% acquisition spend until production ready",
            })
        elif stage in ("PRODUCTION_READY", "BETA_READY"):
            result.findings.append("Beta: 70% pilot onboarding, 20% reliability, 10% leads")
            result.recommended_actions.append({
                "workflow_id": "launch_revenue_review",
                "reason": "allocate 70/20/10 pilot/reliability/leads",
            })
        else:
            result.findings.append("Post-revenue: optimize CAC and scale winning channels")
            result.recommended_actions.append({
                "workflow_id": "launch_revenue_review",
                "reason": "review unit economics and reallocate",
            })

        if metrics["revenue_mtd"] > 0 and metrics["cac"] > metrics["revenue_mtd"]:
            result.healthy = False
            result.findings.append(f"CAC (${metrics['cac']:.0f}) exceeds MTD revenue (${metrics['revenue_mtd']:.0f})")

        return result


# ── 6. TrustHealer ──────────────────────────────────────────────────────────


class TrustHealer:
    """
    Strongest operational privileges after ProtocolGuardian.

    Watches:
      - Failed verification, abnormal scan patterns, copied QR behavior
      - Suspicious geographic patterns, API errors, latency
      - Authentication failures, deployment failures
      - Credential expiration, data anomalies

    Can automatically:
      - retry, restart, roll back, disable bad workflow
      - quarantine suspicious records, notify, open incident
    """

    ROLE = "TrustHealer"

    def assess(self, ctx: Optional[dict] = None) -> SpecialistResult:
        result = SpecialistResult(role=self.ROLE)
        ctx = ctx or {}

        incidents = ctx.get("active_incidents", 0)
        failed_verifications = ctx.get("failed_verifications", 0)
        api_errors = ctx.get("api_errors", 0)
        cred_expiring = ctx.get("credentials_expiring", 0)
        abnormal_scans = ctx.get("abnormal_scan_patterns", 0)

        if incidents > 0:
            result.healthy = False
            result.findings.append(f"{incidents} active incidents")
            result.recommended_actions.append({
                "workflow_id": "launch_incident_response",
                "reason": f"respond to {incidents} active incidents",
            })

        if failed_verifications > 5:
            result.healthy = False
            result.findings.append(f"{failed_verifications} failed verifications — possible protocol issue")
            result.recommended_actions.append({
                "workflow_id": "launch_incident_response",
                "reason": "investigate verification failures",
            })

        if api_errors > 10:
            result.findings.append(f"{api_errors} API errors in last period")
            result.recommended_actions.append({
                "workflow_id": "launch_incident_response",
                "reason": "check API health and retry/circuit-break",
            })

        if cred_expiring > 0:
            result.findings.append(f"{cred_expiring} credentials expiring soon")
            result.recommended_actions.append({
                "workflow_id": "launch_incident_response",
                "reason": f"renew {cred_expiring} expiring credentials",
            })

        if abnormal_scans > 0:
            result.findings.append(f"{abnormal_scans} abnormal scan patterns detected")
            result.recommended_actions.append({
                "workflow_id": "launch_incident_response",
                "reason": "investigate suspicious scan patterns",
            })

        result.metrics = {
            "incidents": incidents,
            "failed_verifications": failed_verifications,
            "api_errors": api_errors,
            "credentials_expiring": cred_expiring,
            "abnormal_scans": abnormal_scans,
        }
        return result


# ── Registry ────────────────────────────────────────────────────────────────

ALL_SPECIALISTS = {
    ProtocolGuardian.ROLE: ProtocolGuardian,
    LaunchBuilder.ROLE: LaunchBuilder,
    GrowthScout.ROLE: GrowthScout,
    PilotCloser.ROLE: PilotCloser,
    RevenueOperator.ROLE: RevenueOperator,
    TrustHealer.ROLE: TrustHealer,
}
