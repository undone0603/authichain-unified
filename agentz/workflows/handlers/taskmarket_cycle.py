"""Taskmarket cycle.

Dry-run reads the receipt ledger and prints the next worker action.
It does not sign, stake, submit, claim, pitch, or pay.
"""

from __future__ import annotations

import json
from pathlib import Path

from agentz.core.modes import ExecutionContext
from agentz.core.taskmarket import (
    LEDGER_PATH,
    fetch_open_tasks,
    ledger_task_ids,
    load_ledger,
    select_task,
)


def run(ctx: ExecutionContext) -> str:
    params = ctx.parameters or {}
    ledger_path = Path(params["ledger_path"]) if params.get("ledger_path") else LEDGER_PATH
    ledger = load_ledger(ledger_path)
    exclude = ledger_task_ids(ledger)
    supplied = params.get("tasks")
    if isinstance(supplied, list):
        tasks = supplied
    else:
        try:
            tasks = fetch_open_tasks()
        except Exception as exc:  # noqa: BLE001 — discovery must not look like a payout
            plan = select_task([], exclude_ids=exclude)
            plan["reason"] = f"Taskmarket list failed: {exc.__class__.__name__}"
            plan["excludedTaskIds"] = sorted(exclude)
            return json.dumps(plan)
    plan = select_task(tasks, exclude_ids=exclude)
    plan["excludedTaskIds"] = sorted(exclude)
    return json.dumps(plan)
