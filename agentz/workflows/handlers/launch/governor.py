"""
agentz.workflows.handlers.launch.governor
------------------------------------------
Handler for the top-level launch_governor workflow.

This is the registry entry point that delegates to the LaunchGovernor
class. It's the workflow you run via:
    python -m agentz.cli run launch_governor --mode dry-run

The Governor itself orchestrates the other launch_* workflows through
the registry/runner — it never bypasses the existing system.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.governor import LaunchGovernor


def run(ctx: ExecutionContext) -> str:
    """Run one full Launch Governor cycle."""
    governor = LaunchGovernor(mode=ctx.mode)
    cycle = governor.run_cycle(verbose=ctx.verbose)

    return (
        f"Cycle {cycle.cycle_id}: "
        f"score {cycle.launch_score_before:.0f}→{cycle.launch_score_after:.0f}, "
        f"stage {cycle.stage_before}→{cycle.stage_after}, "
        f"actions {len(cycle.actions_executed)} executed/"
        f"{len(cycle.actions_blocked)} blocked, "
        f"bottleneck: {cycle.bottleneck}"
    )
