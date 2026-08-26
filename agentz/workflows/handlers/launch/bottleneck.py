"""
agentz.workflows.handlers.launch.bottleneck
-------------------------------------------
Identify the current bottleneck and generate recommended actions.
Uses the Launch Score dimensions to find the weakest link.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext
from agentz.core.launch_state import LaunchStateMachine
from agentz.core.launch_score import calculate_launch_score
from agentz.core.specialists import ALL_SPECIALISTS


def run(ctx: ExecutionContext) -> str:
    """Identify bottleneck and recommend actions."""
    ctx.step("Identifying bottleneck")

    sm = LaunchStateMachine()
    stage = sm.current_stage.value
    score = calculate_launch_score({"stage": stage}, stage)

    # Find the lowest-scoring dimension
    if score.dimensions:
        bottleneck = min(score.dimensions, key=lambda k: score.dimensions[k].score)
        bottleneck_dim = score.dimensions[bottleneck]
    else:
        bottleneck = "unknown"
        bottleneck_dim = None

    # Run specialists to get concrete recommendations
    recommendations = []
    for name, cls in ALL_SPECIALISTS.items():
        specialist = cls()
        result = specialist.assess({"stage": stage})
        for action in result.recommended_actions:
            recommendations.append(f"{name}: {action.get('workflow_id', '?')}")

    if ctx.verbose:
        print(f"  Bottleneck: {bottleneck} ({bottleneck_dim.score:.0f}%)")
        print(f"  Recommendations: {len(recommendations)}")

    return (
        f"BOTTLENECK: {bottleneck} at {bottleneck_dim.score:.0f}%. "
        f"{score.recommended_action}. "
        f"{len(recommendations)} actions recommended."
    )
