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
from typing import Any, Optional

import yaml

from agentz.core.credentials import check_all
from agentz.core.modes import ExecutionContext, Mode

REGISTRY_PATH = Path(__file__).resolve().parents[1] / "workflows" / "registry.yaml"
DEFAULT_AUDIT_LOG = Path(__file__).resolve().parents[1] / "logs" / "runs.jsonl"

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
    max_runs_per_day: Optional[int] = None
    notifications: dict[str, Any] = field(default_factory=dict)
    context_fetcher: Optional[str] = None
    max_retries: int = 0


@dataclass
class RunResult:
    workflow_id: str
    status: str          # "ok" | "skipped" | "failed" | "blocked"
    started_at: str
    finished_at: str
    duration_s: float
    notes: str = ""
    error: Optional[str] = None
    token_usage: dict[str, int] = field(default_factory=dict)
    cost_usd: float = 0.0


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
            cycle = " -> ".join(trail + (wf_id,))
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
    wf: Workflow, mode: Mode, verbose: bool = True, audit_log_path: Path = DEFAULT_AUDIT_LOG
) -> RunResult:
    started = time.time()
    started_iso = datetime.now(timezone.utc).isoformat()

    # 1. Rate limit check
    if wf.max_runs_per_day is not None and audit_log_path.exists():
        recent_count = _count_recent_runs(wf.id, audit_log_path)
        if recent_count >= wf.max_runs_per_day and mode != Mode.DRY_RUN:
            msg = f"rate limit reached: {recent_count}/{wf.max_runs_per_day} runs today"
            return RunResult(
                workflow_id=wf.id,
                status="blocked",
                started_at=started_iso,
                finished_at=datetime.now(timezone.utc).isoformat(),
                duration_s=duration,
                notes=msg,
            )

    # 2. Credential preflight - block live execution, warn-only for dry-run
    present, missing = check_all(wf.requires)
    if missing and mode != Mode.DRY_RUN:
        msg = f"missing credentials: {missing}"
        return RunResult(
            workflow_id=wf.id,
            status="blocked",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=duration,
            notes=msg,
        )
    if missing and mode == Mode.DRY_RUN and verbose:
        print(f"   (dry-run note: missing creds {missing} - would block in live mode)")

    # Promote confirm if workflow self-flags it
    effective_mode = Mode.CONFIRM if wf.confirm_before_run and mode == Mode.AUTO else mode

    print(f"\n[{wf.priority.upper()}] {wf.id} : {wf.title}")
    print(f"   mode={effective_mode.value}  type={wf.type}  est={wf.estimated_minutes}min")
    if wf.description:
        print(f"   {wf.description.strip().splitlines()[0]}")

    ctx = ExecutionContext(mode=effective_mode, workflow_id=wf.id, verbose=verbose)

    # 3. Context Fetcher
    if wf.context_fetcher and mode != Mode.DRY_RUN:
        import shlex
        import subprocess
        ctx.step(f"Context: Running fetcher - {wf.context_fetcher}")
        try:
            cmd = shlex.split(wf.context_fetcher)
            output = subprocess.check_output(cmd, text=True)
            setattr(ctx, "fetched_context", output)
        except Exception as e:
            print(f"   [!] Context fetcher failed: {e}")

    try:
        module = importlib.import_module(f"agentz.workflows.{wf.handler}")
    except ImportError as e:
        return RunResult(
            workflow_id=wf.id,
            status="failed",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=duration,
            error=f"handler import failed: {e}",
        )

    if not hasattr(module, "run"):
        return RunResult(
            workflow_id=wf.id,
            status="failed",
            started_at=started_iso,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_s=duration,
            error=f"handler {wf.handler} has no run(ctx) function",
        )

    attempts = 0
    max_attempts = wf.max_retries + 1
    
    while attempts < max_attempts:
        attempts += 1
        try:
            notes = module.run(ctx) or ""
        duration = time.time() - started
        status = "ok" if effective_mode != Mode.DRY_RUN else "skipped"
        if status == "ok":
            ctx.record_success_signal({"duration_s": duration, "notes": notes})
            token_usage, cost_usd = ctx.get_usage()
            res = RunResult(
                workflow_id=wf.id,
                status,
                started_at=started_iso,
                finished_at=datetime.now(timezone.utc).isoformat(),
                duration_s=duration,
                notes=notes,
                token_usage=token_usage,
                cost_usd=cost_usd,
            )
            if res.status == "ok":
                _trigger_notifications(wf, "Completed", f"Workflow {wf.id} finished successfully.\nNotes: {notes}")
            return res
        except KeyboardInterrupt:
            raise
        except Exception as e:
            if attempts < max_attempts:
                ctx.step(f"Attempt {attempts} failed: {e}. Retrying in 5 seconds...")
                time.sleep(5)
                continue
                
            res = RunResult(
                workflow_id=wf.id,
                status="failed",
                started_at=started_iso,
                finished_at=datetime.now(timezone.utc).isoformat(),
                duration_s=duration,
                error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
            )
            _trigger_notifications(wf, "Failed", f"Workflow {wf.id} failed.\nError: {e}")
            return res


def _trigger_notifications(wf: Workflow, status: str, message: str):
    if not wf.notifications:
        return
    try:
        from agentz.core.notifications import Notifier
        from agentz.core.credentials import get
        
        # Interpolate variables like {{gmail_user}}
        config = {}
        for k, v in wf.notifications.items():
            if isinstance(v, str) and v.startswith("{{") and v.endswith("}}"):
                env_key = v[2:-2].strip()
                config[k] = get(env_key, required=False) or v
            else:
                config[k] = v
                
        notifier = Notifier(config)
        notifier.notify(message, title=f"AgentZ: {wf.id} {status}")
    except Exception as e:
        print(f"   [!] Notification failed: {e}")


def _count_recent_runs(wf_id: str, path: Path) -> int:
    count = 0
    today = datetime.now(timezone.utc).date()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                data = json.loads(line)
                if data["workflow_id"] == wf_id and data["status"] == "ok":
                    dt = datetime.fromisoformat(data["started_at"])
                    if dt.date() == today:
                        count += 1
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    return count


def write_audit_log(results: list[RunResult], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r.__dict__) + "\n")
