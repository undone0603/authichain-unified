"""
agentz.workflows.handlers.launch.weekly_strategy
------------------------------------------------
Weekly economic review: what generated revenue, what generated
qualified opportunities, what consumed money and engineering time.

Decisions:
  - What should be stopped?
  - What should be doubled?
  - Where should the next dollar go?
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.launch_state import LaunchStateMachine
from agentz.core.specialists import RevenueOperator


def run(ctx: ExecutionContext) -> str:
    """Run the weekly strategy review."""
    ctx.step("Running weekly strategy review")

    sm = LaunchStateMachine()
    stage = sm.current_stage.value

    operator = RevenueOperator()
    result = operator.assess({"stage": stage})

    review = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stage": stage,
        "metrics": result.metrics,
        "findings": result.findings,
        "decisions": [],
    }

    # The weekly review should answer the five key questions:
    questions = [
        "What generated revenue?",
        "What generated qualified opportunities?",
        "What consumed money?",
        "What consumed engineering time?",
        "What should be stopped / doubled?",
    ]

    if ctx.verbose:
        print("\n  WEEKLY STRATEGY REVIEW")
        print(f"  Stage: {stage}")
        print()
        for q in questions:
            print(f"  • {q}")
        print()
        for finding in result.findings:
            print(f"  - {finding}")
        for action in result.recommended_actions:
            print(f"  → {action.get('workflow_id', '?')}: {action.get('reason', '')}")

    if ctx.mode != Mode.DRY_RUN:
        report_path = Path(__file__).resolve().parents[2] / "logs" / "reports"
        report_path.mkdir(parents=True, exist_ok=True)
        filename = f"launch_weekly_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
        (report_path / filename).write_text(json.dumps(review, indent=2), encoding="utf-8")

    return (
        f"WEEKLY_STRATEGY: {len(result.findings)} findings, "
        f"{len(result.recommended_actions)} recommendations. "
        f"Stage={stage}"
    )
