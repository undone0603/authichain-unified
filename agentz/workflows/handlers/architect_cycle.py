"""
agentz.workflows.handlers.architect_cycle
-----------------------------------------
Workflow handler that bridges the Unified Architect Agent into the
existing registry / runner system. Run via:
    python -m agentz.cli run architect_cycle --mode dry-run
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.architect import ArchitectAgent


def run(ctx: ExecutionContext) -> str:
    """
    Execute one full architect cycle (assess -> plan -> execute -> review).
    The mode (dry-run / confirm / auto) is propagated from the runner
    so the operator controls side-effects.
    """
    architect = ArchitectAgent()

    goal = "Assess fleet health, fix failing workflows, and run priority jobs."

    report = architect.run_cycle(
        goal=goal,
        mode=ctx.mode,
        verbose=ctx.verbose,
    )

    # Return a concise summary for the audit log's notes field
    return (
        f"Cycle {report.cycle_id}: "
        f"healthy {report.before_healthy}->{report.after_healthy}, "
        f"failing {report.before_failing}->{report.after_failing}, "
        f"net {report.net_improvement:+d}"
    )
