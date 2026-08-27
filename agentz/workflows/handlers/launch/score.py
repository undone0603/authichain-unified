"""
agentz.workflows.handlers.launch.score
---------------------------------------
Calculate the Launch Score and persist it to the score history.
"""
from __future__ import annotations

import json
from agentz.core.modes import ExecutionContext
from agentz.core.launch_state import LaunchStateMachine
from agentz.core.launch_score import calculate_launch_score, persist_score


def run(ctx: ExecutionContext) -> str:
    """Calculate and record the Launch Score."""
    ctx.step("Calculating Launch Score")

    sm = LaunchStateMachine()
    stage = sm.current_stage.value

    # Build context from current state (in production, this would pull
    # from Supabase / health checks / audit logs)
    obs_ctx = {
        "stage": stage,
    }

    score = calculate_launch_score(obs_ctx, stage)

    if ctx.verbose:
        print(score.summary())

    from agentz.core.modes import Mode
    if ctx.mode != Mode.DRY_RUN:
        persist_score(score)

    return (
        f"Launch Score: {score.total:.0f} (stage: {stage}). "
        f"Bottleneck: {score.bottleneck}. "
        f"Recommended: {score.recommended_action}"
    )
