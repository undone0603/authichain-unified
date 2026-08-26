"""
agentz.core.launch_state
-------------------------
The Launch State Machine for AuthiChain.

Defines the nine-stage progression from BOOT → SCALE, with measurable
gates for each transition. The Launch Governor owns this state machine
and advances the stage only when all gates for the current stage pass.

Stages:
  BOOT → PROTOCOL_READY → REFERENCE_IMPLEMENTATION_READY →
  PRODUCTION_READY → BETA_READY → 3_PILOTS → FIRST_REVENUE →
  REPEATABLE_ACQUISITION → SCALE

Each stage has a set of gates (checkable predicates). The Governor
runs all gates for the current stage; if all pass, it advances.
If any fail, it generates actions to close the gaps.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional

from agentz.core.launch_gates import (
    gate_protocol_schema_conformance,
    gate_protocol_signature_verify,
    gate_protocol_negative_fixtures,
    gate_protocol_deterministic,
    gate_protocol_docs,
    gate_ref_impl_builds,
    gate_ref_impl_tests,
    gate_api_openapi,
    gate_qr_roundtrip,
    gate_deployment_healthy,
    gate_db_migrations_clean,
    gate_secrets_present,
    gate_observability_active,
    gate_rollback_tested,
    gate_verification_monitored,
    gate_beta_e2e,
    gate_beta_evidence_page,
    gate_beta_onboarding,
    gate_beta_runbook,
    gate_acquisition_channels,
    gate_conversion_rate,
    gate_outbound_quality,
)

logger = logging.getLogger("agentz.launch_state")


class LaunchStage(str, Enum):
    BOOT = "BOOT"
    PROTOCOL_READY = "PROTOCOL_READY"
    REFERENCE_IMPLEMENTATION_READY = "REFERENCE_IMPLEMENTATION_READY"
    PRODUCTION_READY = "PRODUCTION_READY"
    BETA_READY = "BETA_READY"
    THREE_PILOTS = "3_PILOTS"
    FIRST_REVENUE = "FIRST_REVENUE"
    REPEATABLE_ACQUISITION = "REPEATABLE_ACQUISITION"
    SCALE = "SCALE"


STAGE_ORDER = [
    LaunchStage.BOOT,
    LaunchStage.PROTOCOL_READY,
    LaunchStage.REFERENCE_IMPLEMENTATION_READY,
    LaunchStage.PRODUCTION_READY,
    LaunchStage.BETA_READY,
    LaunchStage.THREE_PILOTS,
    LaunchStage.FIRST_REVENUE,
    LaunchStage.REPEATABLE_ACQUISITION,
    LaunchStage.SCALE,
]


@dataclass
class Gate:
    """A single measurable gate that must pass for a stage transition."""
    id: str
    description: str
    passed: bool = False
    evidence: str = ""
    severity: str = "blocker"  # blocker | warning


@dataclass
class StageAssessment:
    """Result of evaluating all gates for a stage."""
    stage: str
    total_gates: int
    passed: int
    failed: int
    gates: list[Gate] = field(default_factory=list)
    ready_to_advance: bool = False
    blocking_gates: list[str] = field(default_factory=list)

    def summary(self) -> str:
        lines = [
            f"Stage: {self.stage} ({self.passed}/{self.total_gates} gates passed)",
        ]
        for g in self.gates:
            mark = "✓" if g.passed else "✗"
            lines.append(f"  {mark} {g.id}: {g.description}")
            if not g.passed and g.evidence and g.evidence != g.description:
                lines.append(f"      evidence: {g.evidence}")
        if self.blocking_gates:
            lines.append(f"  Blocking: {', '.join(self.blocking_gates)}")
        lines.append(f"  Ready to advance: {self.ready_to_advance}")
        return "\n".join(lines)


# ── Gate Definitions ──────────────────────────────────────────────────────
# Each gate is a function that takes an optional Supabase/audit context
# and returns (passed: bool, evidence: str).
#
# Gates now call real checks (see launch_gates.py). Each gate function:
#   - Uses ctx-provided values if present (avoids re-running expensive checks)
#   - Otherwise runs the real check
#   - If the real check cannot run, returns (False, "unable to verify: ...")
#     — the safe default that blocks stage advancement.

GATE_CHECKS: dict[str, list[Callable[..., tuple[bool, str]]]] = {
    LaunchStage.BOOT.value: [
        lambda ctx: (
            True,
            "system initialized and ready to begin protocol verification",
        ),
    ],
    LaunchStage.PROTOCOL_READY.value: [
        gate_protocol_schema_conformance,
        gate_protocol_signature_verify,
        gate_protocol_negative_fixtures,
        gate_protocol_deterministic,
        gate_protocol_docs,
    ],
    LaunchStage.REFERENCE_IMPLEMENTATION_READY.value: [
        gate_ref_impl_builds,
        gate_ref_impl_tests,
        gate_api_openapi,
        gate_qr_roundtrip,
    ],
    LaunchStage.PRODUCTION_READY.value: [
        gate_deployment_healthy,
        gate_db_migrations_clean,
        gate_secrets_present,
        gate_observability_active,
        gate_rollback_tested,
        gate_verification_monitored,
    ],
    LaunchStage.BETA_READY.value: [
        gate_beta_e2e,
        gate_beta_evidence_page,
        gate_beta_onboarding,
        gate_beta_runbook,
    ],
    LaunchStage.THREE_PILOTS.value: [
        lambda ctx: _check_pilot_count(ctx, 3),
    ],
    LaunchStage.FIRST_REVENUE.value: [
        lambda ctx: _check_revenue(ctx),
    ],
    LaunchStage.REPEATABLE_ACQUISITION.value: [
        gate_acquisition_channels,
        gate_conversion_rate,
        gate_outbound_quality,
    ],
}


def _check_pilot_count(ctx: Optional[dict], min_count: int) -> tuple[bool, str]:
    """Check if we have enough active pilots."""
    if not ctx:
        return False, "no context provided"
    count = ctx.get("active_pilots", 0)
    if count >= min_count:
        return True, f"{count} active pilots (>= {min_count} required)"
    return False, f"{count} active pilots (< {min_count} required)"


def _check_revenue(ctx: Optional[dict]) -> tuple[bool, str]:
    """Check if we have recorded first revenue."""
    if not ctx:
        return False, "no context provided"
    paying = ctx.get("paying_customers", 0)
    if paying >= 1:
        return True, f"{paying} paying customer(s), revenue recorded"
    return False, f"{paying} paying customers (need >= 1)"


# ── State Machine ──────────────────────────────────────────────────────────


STATE_FILE = Path(__file__).resolve().parents[1] / "logs" / "launch_state.json"


class LaunchStateMachine:
    """
    Manages the current launch stage and its transition gates.
    State persists to logs/launch_state.json so it survives restarts.
    """

    def __init__(self, state_file: Path = STATE_FILE):
        self.state_file = state_file
        self._state: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        if self.state_file.exists():
            try:
                self._state = json.loads(self.state_file.read_text(encoding="utf-8"))
            except Exception as e:
                logger.warning(f"Failed to load launch state: {e}")
                self._state = {}
        if not self._state:
            self._state = {
                "current_stage": LaunchStage.BOOT.value,
                "history": [],
                "entered_at": datetime.now(timezone.utc).isoformat(),
            }

    def _save(self) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(self._state, indent=2), encoding="utf-8")

    @property
    def current_stage(self) -> LaunchStage:
        return LaunchStage(self._state.get("current_stage", LaunchStage.BOOT.value))

    def assess_stage(
        self, stage: Optional[LaunchStage] = None, context: Optional[dict] = None
    ) -> StageAssessment:
        """
        Evaluate all gates for the given stage (or current stage if None).
        Returns a StageAssessment with pass/fail for each gate.
        """
        s = stage or self.current_stage
        checks = GATE_CHECKS.get(s.value, [])
        gates: list[Gate] = []
        blocking: list[str] = []

        for i, check_fn in enumerate(checks):
            gate_id = f"{s.value.lower()}.gate_{i+1}"
            try:
                passed, evidence = check_fn(context)
            except Exception as e:
                passed = False
                evidence = f"gate check error: {e}"
            g = Gate(id=gate_id, description=evidence, passed=passed, evidence=evidence)
            gates.append(g)
            if not passed and g.severity == "blocker":
                blocking.append(gate_id)

        passed_count = sum(1 for g in gates if g.passed)
        return StageAssessment(
            stage=s.value,
            total_gates=len(gates),
            passed=passed_count,
            failed=len(gates) - passed_count,
            gates=gates,
            ready_to_advance=len(blocking) == 0 and len(gates) > 0,
            blocking_gates=blocking,
        )

    def advance(self, context: Optional[dict] = None) -> bool:
        """
        Assess the current stage. If all gates pass, advance to the next stage.
        Returns True if advanced, False if not ready.
        """
        assessment = self.assess_stage(self.current_stage, context)
        if not assessment.ready_to_advance:
            logger.info(
                f"Cannot advance from {self.current_stage.value}: "
                f"{len(assessment.blocking_gates)} blocking gates"
            )
            return False

        current_idx = STAGE_ORDER.index(self.current_stage)
        if current_idx >= len(STAGE_ORDER) - 1:
            logger.info("Already at SCALE — no further stages")
            return False

        new_stage = STAGE_ORDER[current_idx + 1]
        self._state["history"].append({
            "from": self.current_stage.value,
            "to": new_stage.value,
            "at": datetime.now(timezone.utc).isoformat(),
            "assessment": asdict(assessment),
        })
        self._state["current_stage"] = new_stage.value
        self._state["entered_at"] = datetime.now(timezone.utc).isoformat()
        self._save()
        logger.info(f"Advanced: {self.current_stage.value} → {new_stage.value}")
        return True

    def set_stage(self, stage: LaunchStage) -> None:
        """Manually set the stage (for testing or operator override)."""
        self._state["current_stage"] = stage.value
        self._state["entered_at"] = datetime.now(timezone.utc).isoformat()
        self._save()

    def to_dict(self) -> dict[str, Any]:
        return {
            "current_stage": self.current_stage.value,
            "entered_at": self._state.get("entered_at", ""),
            "history": self._state.get("history", []),
        }
