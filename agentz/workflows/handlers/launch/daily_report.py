"""
agentz.workflows.handlers.launch.daily_report
---------------------------------------------
Generate the daily Launch Control report.

Outputs the one-page dashboard:
  - Launch Score + breakdown
  - Current stage
  - Pipeline metrics
  - Current bottleneck
  - Recommended action
  - Agent activity status
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from agentz.core.modes import ExecutionContext
from agentz.core.launch_state import LaunchStateMachine
from agentz.core.launch_score import calculate_launch_score
from agentz.core.specialists import ALL_SPECIALISTS


def run(ctx: ExecutionContext) -> str:
    """Generate the daily Launch Control report."""
    ctx.step("Generating daily Launch Control report")

    sm = LaunchStateMachine()
    stage = sm.current_stage.value

    score = calculate_launch_score({"stage": stage}, stage)

    # Specialist status
    agent_status = {}
    for name, cls in ALL_SPECIALISTS.items():
        specialist = cls()
        result = specialist.assess({"stage": stage})
        agent_status[name] = "HEALTHY" if result.healthy else "ISSUES"

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "launch_score": round(score.total, 1),
        "stage": stage,
        "dimensions": {
            name: round(dim.score, 1)
            for name, dim in score.dimensions.items()
        },
        "bottleneck": score.bottleneck,
        "recommended_action": score.recommended_action,
        "agent_activity": agent_status,
    }

    if ctx.verbose:
        print("\n" + "=" * 52)
        print("  AUTHICHAIN LAUNCH CONTROL")
        print("=" * 52)
        print(f"  Launch Score                   {score.total:.0f}")
        print(f"  Stage                          {stage}")
        print()
        for name, dim in score.dimensions.items():
            bar = "█" * int(dim.score / 10) + "░" * (10 - int(dim.score / 10))
            print(f"  {name.upper():14s} {bar} {dim.score:3.0f}%")
        print()
        print(f"  BOTTLENECK: {score.bottleneck}")
        print(f"  RECOMMENDED: {score.recommended_action}")
        print()
        print("  AGENT ACTIVITY")
        for name, status in agent_status.items():
            print(f"  {name:20s} {status}")
        print("=" * 52)

    # Persist the report
    from agentz.core.modes import Mode
    if ctx.mode != Mode.DRY_RUN:
        report_path = Path(__file__).resolve().parents[2] / "logs" / "reports"
        report_path.mkdir(parents=True, exist_ok=True)
        filename = f"launch_daily_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
        (report_path / filename).write_text(json.dumps(report, indent=2), encoding="utf-8")

    return (
        f"DAILY_REPORT: Score={score.total:.0f}, Stage={stage}, "
        f"Bottleneck={score.bottleneck}"
    )
