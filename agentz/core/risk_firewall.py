"""
agentz.core.risk_firewall
-------------------------
Capital & Reputation Firewall for the Launch Governor.

Every workflow carries a risk classification. The firewall enforces:
  - Approval gating: high-risk workflows always require human confirmation,
    even in AUTO mode.
  - Budget enforcement: cumulative spend per workflow per day cannot exceed
    financial_limit_usd.
  - Veto enforcement: ProtocolGuardian-class workflows can block execution
    of other workflows if protocol integrity is at stake.

This sits between the registry load and the handler dispatch in runner.execute(),
so every workflow passes through the firewall before touching anything.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger("agentz.risk_firewall")


class RiskClass(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReputationalImpact(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# Risk class → minimum required mode escalation.
# AUTO is always allowed for LOW. MEDIUM allows AUTO if no human flag.
# HIGH always escalates to CONFIRM. CRITICAL always escalates and logs.
RISK_ESCALATION = {
    RiskClass.LOW: None,           # no escalation
    RiskClass.MEDIUM: None,        # no automatic escalation (but requires_human_approval can)
    RiskClass.HIGH: "confirm",     # always confirm
    RiskClass.CRITICAL: "confirm", # always confirm + veto check
}

# Workflows that ProtocolGuardian can veto — these touch protocol semantics
PROTOCOL_VETO_WORKFLOWS = {
    "launch_protocol_gate",
    "protocol_schema_validate",
    "protocol_signature_verify",
    "protocol_negative_fixtures",
}


@dataclass
class RiskAssessment:
    """Result of evaluating a workflow through the firewall."""

    approved: bool
    escalated_mode: Optional[str] = None  # "confirm" if mode was escalated
    reason: str = ""
    budget_remaining: float = 0.0
    vetoed: bool = False
    veto_reason: str = ""


@dataclass
class FirewallBlock:
    """Returned when the firewall blocks execution entirely."""

    workflow_id: str
    reason: str
    risk_class: str
    budget_exceeded: bool = False
    vetoed: bool = False


def assess_workflow(
    wf_id: str,
    risk_class: str,
    financial_limit_usd: float,
    requires_human_approval: bool,
    current_mode: str,
    audit_log_path: Path,
    protocol_veto_active: bool = False,
) -> RiskAssessment:
    """
    Evaluate a workflow against the firewall.

    Returns a RiskAssessment with:
      - approved: True if execution can proceed
      - escalated_mode: "confirm" if the mode was escalated, None otherwise
      - reason: human-readable explanation
    """
    rc = RiskClass(risk_class) if risk_class in [r.value for r in RiskClass] else RiskClass.LOW
    escalated = RISK_ESCALATION.get(rc)
    mode = current_mode

    # 1. Escalation: HIGH and CRITICAL always go to CONFIRM
    if escalated == "confirm" and mode == "auto":
        mode = "confirm"

    # 2. Human approval flag overrides AUTO
    if requires_human_approval and mode == "auto":
        mode = "confirm"

    # 3. Protocol veto: if ProtocolGuardian has flagged a veto, block
    # protocol-touching workflows
    if rc == RiskClass.CRITICAL and protocol_veto_active and wf_id in PROTOCOL_VETO_WORKFLOWS:
        return RiskAssessment(
            approved=False,
            escalated_mode=mode,
            reason=f"ProtocolGuardian veto active — {wf_id} blocked",
            vetoed=True,
            veto_reason="Protocol integrity at risk — manual review required",
        )

    # 4. Budget enforcement: check cumulative spend today
    if financial_limit_usd > 0:
        spent = _cumulative_spend_today(wf_id, audit_log_path)
        remaining = financial_limit_usd - spent
        if remaining <= 0:
            return RiskAssessment(
                approved=False,
                escalated_mode=mode,
                reason=(
                    f"budget exhausted: ${spent:.2f} spent / ${financial_limit_usd:.2f} limit"
                ),
                budget_remaining=0.0,
            )
        return RiskAssessment(
            approved=True,
            escalated_mode=mode if mode != current_mode else None,
            reason=f"approved (budget ${remaining:.2f} remaining of ${financial_limit_usd:.2f})",
            budget_remaining=remaining,
        )

    # 5. No budget limit — standard approval
    return RiskAssessment(
        approved=True,
        escalated_mode=mode if mode != current_mode else None,
        reason=f"approved (risk={rc.value}, mode={mode})",
    )


def _cumulative_spend_today(wf_id: str, audit_log_path: Path) -> float:
    """Sum cost_usd for this workflow's runs today."""
    if not audit_log_path.exists():
        return 0.0
    total = 0.0
    today = datetime.now(timezone.utc).date()
    try:
        with audit_log_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    data = json.loads(line)
                    if data.get("workflow_id") != wf_id:
                        continue
                    if data.get("status") not in ("ok", "skipped"):
                        continue
                    started = data.get("started_at", "")
                    if started:
                        dt = datetime.fromisoformat(started)
                        if dt.date() == today:
                            total += data.get("cost_usd", 0.0)
                except (json.JSONDecodeError, KeyError, ValueError):
                    continue
    except Exception as e:
        logger.warning(f"Failed to read audit log for budget check: {e}")
    return total


def should_force_confirm(
    risk_class: str,
    requires_human_approval: bool,
    current_mode: str,
) -> bool:
    """Quick check: should this workflow be forced into CONFIRM mode?"""
    if current_mode != "auto":
        return False
    if requires_human_approval:
        return True
    rc = RiskClass(risk_class) if risk_class in [r.value for r in RiskClass] else RiskClass.LOW
    return RISK_ESCALATION.get(rc) == "confirm"
