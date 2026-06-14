"""
agentz.core.runner
------------------
Loads registry.yaml, resolves dependencies, dispatches to handlers,
records run state to Supabase audit table.
"""
from __future__ import annotations

import importlib
import json
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml

from agentz.core.credentials import check_all
from agentz.core.modes import ExecutionContext, Mode

REGISTRY_PATH = Path(__file__).resolve().parents[1] / "workflows" / "registry.yaml"

PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


@dataclass
class Workflow:
    id: str
    title: str
    priority: str
    blocks_revenue: bool
    handler: str
    type: str
    estimated_minutes: int
    requires: list[str] = field(default_factory=list)
    prerequisites: list[str] = field(default_factory=list)
    description: str = ""
    confirm_before_run: bool = False


@dataclass
class RunResult:
    workflow_id: str
    status: str          # "ok" | "skipped" | "failed" | "blocked"
    started_at: str
    finished_at: str
    duration_s: float
    notes: str = ""
    error: Optional[str] = None


def load_registry(path: Path = REGISTRY_PATH) -> dict[str, Workflow]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    out: dict[str, Workflow] = {}
    for entry in raw.get("workflows", []):
        wf = Workflow(**entry)
        out[wf.id] = wf
    return out


def resolve_order(
    registry: dict[str, Workflow], requested: list[str]
) -> list[Workflow]:
    """Topological sort honoring prerequisites; preserves priority for ties."""
    selected: dict[str, Workflow] = {}

    def add(wf_id: str, trail: tuple[str, ...] = ()) -> None:
        if wf_id in selected:
            return
        if wf_id in trail:
            cycle = " → ".join(trail + (wf_id,))
            raise RuntimeError(f"Prerequisite cycle: {cycle}")
        wf = registry.get(wf_id)
        if not wf:
            raise KeyError(f"Unknown workflow: {wf_id}")
        for prereq in wf.prerequisites:
            add(prereq, trail + (wf_id,))
        selected[wf_id] = wf

    for wf_id in requested:
        add(wf_id)

    # Stable sort: dependency-respecting insertion order, then priority for unrelated peers
    items = list(selected.values())
    items.sort(key=lambda w: PRIORITY_RANK.get(w.priority, 99))
    # Re-apply topological correctness on top of priority sort
    seen, ordered = set(), []
    def emit(wf: Workflow) -> None:
        if wf.id in seen:
            return
        for prereq in wf.prerequisites:
            emit(selected[prereq])
        seen.add(wf.id)
        ordered.append(wf)
    for wf in items:
        emit(wf)
    return ordered


def execute(
    wf: Workflow, mode: Mode, verbose: bool = True
) -> RunResult:
    started = time.time()
    started_iso = datetime.now(timezone.utc).isoformat()

    # Credential preflight — block live execution, warn-only for dry-run
    present, missing = check_all(wf.requires)
    if missing and mode != Mode.DRY_RUN:
        msg = f"missing credentials: {missing}"
        return RunResult(
            workflow_id=wf.id,
            status="blocked",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=time.time() - started,
            notes=msg,
        )
    if missing and mode == Mode.DRY_RUN and verbose:
        print(f"   (dry-run note: missing creds {missing} — would block in live mode)")

    # Promote confirm if workflow self-flags it
    effective_mode = Mode.CONFIRM if wf.confirm_before_run and mode == Mode.AUTO else mode

    print(f"\n[{wf.priority.upper()}] {wf.id} — {wf.title}")
    print(f"   mode={effective_mode.value}  type={wf.type}  est={wf.estimated_minutes}min")
    if wf.description:
        print(f"   {wf.description.strip().splitlines()[0]}")

    ctx = ExecutionContext(mode=effective_mode, workflow_id=wf.id, verbose=verbose)

    try:
        module = importlib.import_module(f"agentz.workflows.{wf.handler}")
    except ImportError as e:
        return RunResult(
            workflow_id=wf.id,
            status="failed",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=time.time() - started,
            error=f"handler import failed: {e}",
        )

    if not hasattr(module, "run"):
        return RunResult(
            workflow_id=wf.id,
            status="failed",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=time.time() - started,
            error=f"handler {wf.handler} has no run(ctx) function",
        )

    try:
        notes = module.run(ctx) or ""
        return RunResult(
            workflow_id=wf.id,
            status="ok" if effective_mode != Mode.DRY_RUN else "skipped",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=time.time() - started,
            notes=notes,
        )
    except KeyboardInterrupt:
        raise
    except Exception as e:
        return RunResult(
            workflow_id=wf.id,
            status="failed",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=time.time() - started,
            error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
        )


def write_audit_log(results: list[RunResult], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r.__dict__) + "\n")
