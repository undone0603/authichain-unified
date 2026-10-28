"""Read-only Taskmarket cycle.

Prints the one worker action AgentZ should take next. Does not sign,
stake, submit, claim, pitch, or pay.
"""

from __future__ import annotations

import json

from agentz.core.modes import ExecutionContext
from agentz.core.taskmarket import fetch_open_tasks, select_task


def run(ctx: ExecutionContext) -> str:
    supplied = ctx.parameters.get("tasks") if ctx.parameters else None
    if isinstance(supplied, list):
        tasks = supplied
    else:
        try:
            tasks = fetch_open_tasks()
        except Exception as exc:  # noqa: BLE001 — discovery must not look like a payout
            plan = select_task([])
            plan["reason"] = f"Taskmarket list failed: {exc.__class__.__name__}"
            return json.dumps(plan)
    plan = select_task(tasks)
    return json.dumps(plan)
