"""Unattended run loop for the AgentZ registry.

Orders workflows by dependency, then priority, and runs each one through the
guarded runner (``python -m agentz.workflows.runner``). Every step therefore
still passes the kill switch, policy, approval gate, risk firewall and the
independent verifier. The loop adds ordering, bounded retries and an
append-only ledger.

Safe by default:
  * mode is ``dry-run``; ``auto`` needs allow_auto=True, and running the whole
    registry in auto additionally needs allow_all=True
  * workflows above ``max_risk`` (default medium) are skipped
  * outbound-communication workflows are excluded from "run everything"
  * the kill switch is re-checked before every step and every retry
  * ``max_steps`` bounds an unattended run
  * only plain handler failures are retried; a failed verification, a missing
    approval or a timeout never is, because side effects may already have happened
"""

from __future__ import annotations

import heapq
import json
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from agentz.core import autonomy_policy as ap

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_KILLED = 10
EXIT_APPROVAL = 11
EXIT_VERIFY = 12
EXIT_POLICY = 13
EXIT_TIMEOUT = 124

OK, FAILED, AWAITING, VERIFY_FAILED, SKIPPED, HALTED = (
    "ok", "failed", "awaiting_approval", "verify_failed", "skipped", "halted",
)

_PRIORITY = {"critical": 0, "high": 1, "medium": 2, "low": 3}
_RISK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
DEFAULT_EXCLUDE = ("outreach", "launch_post", "social", "blitz", "email_blast", "mass_email")


class AutoModeNotAllowed(RuntimeError):
    """Raised when an unattended auto run was requested without explicit opt-in."""


@dataclass
class StepResult:
    workflow_id: str
    status: str
    exit_code: Optional[int] = None
    attempts: int = 0
    reason: str = ""


@dataclass
class LoopReport:
    run_id: str
    mode: str
    steps: List[StepResult] = field(default_factory=list)
    halted: bool = False
    halt_code: int = EXIT_KILLED
    halt_reason: str = ""

    def counts(self) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for step in self.steps:
            out[step.status] = out.get(step.status, 0) + 1
        return out

    @property
    def exit_code(self) -> int:
        if self.halted:
            return self.halt_code
        statuses = {s.status for s in self.steps}
        if FAILED in statuses or VERIFY_FAILED in statuses:
            return EXIT_FAILED
        if AWAITING in statuses:
            return EXIT_APPROVAL
        return EXIT_OK

    def summary(self) -> str:
        parts = ", ".join("%s=%d" % kv for kv in sorted(self.counts().items())) or "no steps"
        head = "[autoloop] run %s mode=%s: %s" % (self.run_id, self.mode, parts)
        if self.halted:
            head += " | HALTED: %s" % self.halt_reason
        lines = [head]
        for s in self.steps:
            extra = (" - " + s.reason) if s.reason else ""
            lines.append("[autoloop]   %-16s %s%s" % (s.status, s.workflow_id, extra))
        return "\n".join(lines)


def _prio(policy) -> int:
    return _PRIORITY.get(str(policy.priority).lower(), 4)


def _risk_rank(value) -> int:
    return _RISK.get(str(getattr(value, "value", value)).lower(), _RISK["high"])


def plan(
    policies: Sequence["ap.WorkflowPolicy"],
    selected: Optional[Sequence[str]] = None,
    *,
    include_prerequisites: bool = True,
    max_risk: str = "medium",
    exclude: Sequence[str] = DEFAULT_EXCLUDE,
) -> Tuple[List["ap.WorkflowPolicy"], List[Tuple[str, str]]]:
    """Return (ordered runnable policies, [(workflow_id, reason skipped)])."""
    by_id = {p.workflow_id: p for p in policies}
    index = {p.workflow_id: i for i, p in enumerate(policies)}
    patterns = [x.lower() for x in exclude if x]
    ceiling = _risk_rank(max_risk)
    skipped: Dict[str, str] = {}

    explicit = selected is not None
    chosen: List[str] = []
    if explicit:
        for wid in selected or []:
            if wid not in by_id:
                skipped[wid] = "unknown workflow"
            elif wid not in chosen:
                chosen.append(wid)
    else:
        for p in policies:
            if any(pat in p.workflow_id.lower() for pat in patterns):
                skipped[p.workflow_id] = "excluded: outbound-communication workflow"
            else:
                chosen.append(p.workflow_id)

    candidates = list(chosen)
    if include_prerequisites:
        stack = list(chosen)
        while stack:
            for pre in by_id[stack.pop()].prerequisites:
                if pre in by_id and pre not in candidates:
                    candidates.append(pre)
                    stack.append(pre)

    runnable: List[str] = []
    for wid in candidates:
        p = by_id[wid]
        if not p.handler:
            skipped[wid] = "no handler"
        elif _risk_rank(p.risk_class) > ceiling:
            skipped[wid] = "risk class %s exceeds max-risk %s" % (p.risk_class, max_risk)
        elif wid not in chosen and any(pat in wid.lower() for pat in patterns):
            skipped[wid] = "excluded: outbound-communication workflow"
        else:
            runnable.append(wid)

    changed = True
    while changed and include_prerequisites:
        changed = False
        for wid in list(runnable):
            for pre in by_id[wid].prerequisites:
                if pre not in by_id:
                    skipped[wid] = "unresolved prerequisite %r" % pre
                elif pre not in runnable:
                    skipped[wid] = "prerequisite %s not runnable (%s)" % (pre, skipped.get(pre, "not selected"))
                else:
                    continue
                runnable.remove(wid)
                changed = True
                break

    live = set(runnable)
    deps = {w: [d for d in by_id[w].prerequisites if d in live] for w in runnable}
    waiting = {w: len(d) for w, d in deps.items()}
    children: Dict[str, List[str]] = {w: [] for w in runnable}
    for w, ds in deps.items():
        for d in ds:
            children[d].append(w)

    def key(w: str):
        p = by_id[w]
        return (_prio(p), 0 if p.blocks_revenue else 1, index[w], w)

    heap = [key(w) for w in runnable if waiting[w] == 0]
    heapq.heapify(heap)
    ordered: List[str] = []
    while heap:
        w = heapq.heappop(heap)[-1]
        ordered.append(w)
        for c in children[w]:
            waiting[c] -= 1
            if waiting[c] == 0:
                heapq.heappush(heap, key(c))
    for w in runnable:
        if w not in ordered:
            skipped[w] = "dependency cycle"

    return [by_id[w] for w in ordered], sorted(skipped.items())


# ---------------------------------------------------------------- ledger ----

def ledger_path() -> Path:
    return Path(ap.state_dir()) / "autoloop-ledger.jsonl"


def _append(event: Dict[str, object]) -> bool:
    event = dict(event, ts=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    try:
        path = ledger_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, sort_keys=True) + "\n")
        return True
    except OSError:
        return False


def read_ledger(limit: int = 50) -> List[Dict[str, object]]:
    """Newest-last list of ledger events; torn or corrupt lines are ignored."""
    path = ledger_path()
    if not path.exists():
        return []
    events: List[Dict[str, object]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            item = json.loads(line)
        except ValueError:
            continue
        if isinstance(item, dict):
            events.append(item)
    return events[-limit:] if limit else events


# ---------------------------------------------------------------- runner ----

def _runner_name(policy) -> str:
    handler = policy.handler or ""
    return handler.split(".", 1)[1] if handler.startswith("handlers.") else handler


def run_via_runner(policy, mode: str, timeout: float = 1800.0) -> int:
    """Run one workflow through the guarded runner in a fresh interpreter."""
    cmd = [sys.executable, "-m", "agentz.workflows.runner", "--handler", _runner_name(policy), "--mode", mode]
    try:
        return subprocess.run(cmd, timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        return EXIT_TIMEOUT


def run_loop(
    policies: Sequence["ap.WorkflowPolicy"],
    *,
    selected: Optional[Sequence[str]] = None,
    mode: str = "dry-run",
    allow_auto: bool = False,
    allow_all: bool = False,
    max_risk: str = "medium",
    exclude: Sequence[str] = DEFAULT_EXCLUDE,
    include_prerequisites: bool = True,
    max_steps: int = 25,
    base_delay: float = 2.0,
    max_delay: float = 60.0,
    timeout: float = 1800.0,
    run_one: Optional[Callable[["ap.WorkflowPolicy", str], int]] = None,
    sleep: Callable[[float], None] = time.sleep,
) -> LoopReport:
    mode = str(mode).lower()
    if mode not in ("dry-run", "auto"):
        raise ValueError("the unattended loop supports dry-run and auto, not %r" % mode)
    if mode == "auto" and not allow_auto:
        raise AutoModeNotAllowed("auto mode needs allow_auto=True (explicit opt-in)")
    if mode == "auto" and selected is None and not allow_all:
        raise AutoModeNotAllowed("running the whole registry in auto mode needs allow_all=True")

    runner = run_one or (lambda pol, m: run_via_runner(pol, m, timeout))
    by_id = {p.workflow_id: p for p in policies}
    order, skipped = plan(
        policies, selected, include_prerequisites=include_prerequisites, max_risk=max_risk, exclude=exclude
    )
    report = LoopReport(run_id=uuid.uuid4().hex[:12], mode=mode)
    _append({"event": "run_start", "run_id": report.run_id, "mode": mode, "planned": [p.workflow_id for p in order]})
    for wid, why in skipped:
        report.steps.append(StepResult(wid, SKIPPED, reason=why))
        _append({"event": "step", "run_id": report.run_id, "workflow_id": wid, "status": SKIPPED, "reason": why})

    outcome: Dict[str, str] = {}
    in_plan = {p.workflow_id for p in order}
    executed = 0

    def record(step: StepResult) -> None:
        report.steps.append(step)
        outcome[step.workflow_id] = step.status
        _append({
            "event": "step", "run_id": report.run_id, "workflow_id": step.workflow_id,
            "status": step.status, "exit_code": step.exit_code, "attempts": step.attempts, "reason": step.reason,
        })

    def halt(code: int, reason: str) -> None:
        report.halted, report.halt_code, report.halt_reason = True, code, reason

    for pos, pol in enumerate(order):
        killed, why = ap.kill_switch_status()
        if killed:
            halt(EXIT_KILLED, "kill switch: " + why)
        if report.halted:
            for rest in order[pos:]:
                record(StepResult(rest.workflow_id, HALTED, reason=report.halt_reason))
            break
        blockers = [d for d in pol.prerequisites if d in in_plan and outcome.get(d) != OK]
        if blockers:
            record(StepResult(pol.workflow_id, SKIPPED, reason="prerequisite %s: %s" % (blockers[0], outcome.get(blockers[0], "not run"))))
            continue
        if executed >= max_steps:
            record(StepResult(pol.workflow_id, SKIPPED, reason="max_steps budget (%d) reached" % max_steps))
            continue
        executed += 1
        attempts = 0
        while True:
            attempts += 1
            code = runner(pol, mode)
            if code == EXIT_OK:
                record(StepResult(pol.workflow_id, OK, code, attempts))
            elif code == EXIT_KILLED:
                record(StepResult(pol.workflow_id, HALTED, code, attempts, "kill switch engaged"))
                halt(EXIT_KILLED, "kill switch engaged during %s" % pol.workflow_id)
            elif code == EXIT_POLICY:
                record(StepResult(pol.workflow_id, HALTED, code, attempts, "policy unavailable"))
                halt(EXIT_POLICY, "policy unavailable (registry unreadable)")
            elif code == EXIT_APPROVAL:
                record(StepResult(pol.workflow_id, AWAITING, code, attempts, "human approval queued"))
            elif code == EXIT_VERIFY:
                record(StepResult(pol.workflow_id, VERIFY_FAILED, code, attempts, "independent verification failed"))
            elif code == EXIT_TIMEOUT:
                record(StepResult(pol.workflow_id, FAILED, code, attempts, "timed out"))
            elif attempts < pol.max_attempts:
                sleep(min(max_delay, base_delay * (2 ** (attempts - 1))))
                killed, why = ap.kill_switch_status()
                if killed:
                    record(StepResult(pol.workflow_id, HALTED, code, attempts, "kill switch before retry"))
                    halt(EXIT_KILLED, "kill switch: " + why)
                    break
                continue
            else:
                record(StepResult(pol.workflow_id, FAILED, code, attempts, "exit code %s" % code))
            break
    _append({"event": "run_end", "run_id": report.run_id, "exit_code": report.exit_code, "counts": report.counts()})
    return report
