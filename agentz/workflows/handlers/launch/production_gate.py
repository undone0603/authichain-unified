"""
agentz.workflows.handlers.launch.production_gate
--------------------------------------------------
LaunchBuilder gate: verify production readiness before transitioning
to beta. Checks deployment health, DB migrations, secrets, observability.

Can auto-fix: lint, formatting, broken tests with obvious fixes, CI failures.
Requires approval for: production secrets, DB destruction, protocol changes.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext
from agentz.core.launch_state import LaunchStateMachine, LaunchStage
from agentz.core.specialists import LaunchBuilder


def run(ctx: ExecutionContext) -> str:
    """Run the LaunchBuilder production gate checks."""
    ctx.step("LaunchBuilder: running production gate checks")

    builder = LaunchBuilder()
    result = builder.assess({
        "open_github_issues": 0,
        "failing_tests": 0,
        "ci_failing": False,
    })

    sm = LaunchStateMachine()
    assessment = sm.assess_stage(LaunchStage.PRODUCTION_READY)

    if ctx.verbose:
        print(f"  Builder healthy: {result.healthy}")
        print(f"  Production gates: {assessment.passed}/{assessment.total_gates} passed")
        for f in result.findings:
            print(f"  - {f}")

    if assessment.ready_to_advance:
        return f"PRODUCTION_GATE: PASSED — ready for {LaunchStage.BETA_READY.value}"

    return (
        f"PRODUCTION_GATE: {assessment.passed}/{assessment.total_gates} gates passed. "
        f"Blocking: {', '.join(assessment.blocking_gates) or 'none'}. "
        f"Findings: {'; '.join(result.findings) or 'none'}"
    )
