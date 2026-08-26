"""
agentz.workflows.handlers.launch.beta_gate
-------------------------------------------
Beta readiness gate: verify end-to-end customer flow works before
onboarding real pilots.

Checks:
  - registration → attestation → QR → verification end-to-end
  - Evidence page works for a real product
  - Customer onboarding flow exists and is documented
  - Support/runbook exists
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext
from agentz.core.launch_state import LaunchStateMachine, LaunchStage


def run(ctx: ExecutionContext) -> str:
    """Run the beta readiness gate checks."""
    ctx.step("Running beta readiness gate checks")

    sm = LaunchStateMachine()
    assessment = sm.assess_stage(LaunchStage.BETA_READY)

    if ctx.verbose:
        print(f"  Beta gates: {assessment.passed}/{assessment.total_gates} passed")
        for g in assessment.gates:
            mark = "✓" if g.passed else "✗"
            print(f"  {mark} {g.description}")

    if assessment.ready_to_advance:
        return f"BETA_GATE: PASSED — ready for {LaunchStage.THREE_PILOTS.value}"

    return (
        f"BETA_GATE: {assessment.passed}/{assessment.total_gates} gates passed. "
        f"Blocking: {', '.join(assessment.blocking_gates) or 'none'}"
    )
