"""Autonomy policy layer for AgentZ.

Three small, dependency-free building blocks that let workflows run unattended
without losing human control:

1. Kill switch     - one env var or one file halts every autonomous run.
2. Policy          - risk class, spend limit and approval need come from
                     workflows/registry.yaml instead of being hard-coded.
3. Approval queue  - append-only JSONL log. Unattended runs that need a human
                     enqueue a request and exit; a human approves it later
                     (python -m agentz.cli approvals approve <id>).

Everything fails closed: unknown risk classes become "high", an expired or
rejected approval never authorises a run, and approvals are single-use.
"""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

AGENTZ_DIR = Path(__file__).resolve().parents[1]
REGISTRY_PATH = AGENTZ_DIR / "workflows" / "registry.yaml"

RISK_CLASSES = ("low", "medium", "high", "critical")
DEFAULT_RISK_CLASS = "medium"
DEFAULT_FINANCIAL_LIMIT_USD = 100.0
DEFAULT_APPROVAL_TTL_HOURS = 24.0
_TRUTHY = {"1", "true", "yes", "on"}


def state_dir() -> Path:
    """Directory for logs and approvals (override with AGENTZ_STATE_DIR)."""
    override = os.getenv("AGENTZ_STATE_DIR")
    return Path(override) if override else AGENTZ_DIR / "logs"


# ---------------------------------------------------------------------------
# Kill switch
# ---------------------------------------------------------------------------
def kill_file_path() -> Path:
    override = os.getenv("AGENTZ_KILL_FILE")
    return Path(override) if override else AGENTZ_DIR / "KILL_SWITCH"


def kill_switch_status() -> tuple[bool, str]:
    """Return (engaged, reason). Engaged by env var or by the kill file."""
    if os.getenv("AGENTZ_KILL_SWITCH", "").strip().lower() in _TRUTHY:
        return True, "AGENTZ_KILL_SWITCH is set"
    path = kill_file_path()
    if path.exists():
        note = ""
        try:
            lines = path.read_text(encoding="utf-8").strip().splitlines()
            note = lines[0][:200] if lines else ""
        except OSError:
            pass
        return True, f"kill file present ({path.name})" + (f": {note}" if note else "")
    return False, ""


def engage_kill_switch(reason: str = "manual") -> Path:
    path = kill_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    path.write_text(f"{reason}\nengaged_at={stamp}\n", encoding="utf-8")
    return path


def release_kill_switch() -> bool:
    """Remove the kill file. Returns True if a file was removed."""
    path = kill_file_path()
    if path.exists():
        path.unlink()
        return True
    return False


# ---------------------------------------------------------------------------
# Registry-driven policy
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class WorkflowPolicy:
    workflow_id: str
    handler: str = ""
    risk_class: str = DEFAULT_RISK_CLASS
    financial_limit_usd: float = DEFAULT_FINANCIAL_LIMIT_USD
    requires_human_approval: bool = False
    type: str = "api"
    priority: str = "medium"
    blocks_revenue: bool = False
    prerequisites: tuple = ()
    requires: tuple = ()
    verify: tuple = ()
    max_attempts: int = 1
    from_registry: bool = False


class PolicyUnavailable(RuntimeError):
    """The registry exists but cannot be read (PyYAML missing or invalid YAML)."""


def strict_policy() -> bool:
    """AGENTZ_POLICY_STRICT=1 refuses to run when the registry cannot be read."""
    return os.getenv("AGENTZ_POLICY_STRICT", "").strip().lower() in _TRUTHY


def load_registry(path: Optional[Path] = None) -> list[dict[str, Any]]:
    """Load registry entries.

    Returns [] when the file does not exist. Raises PolicyUnavailable when it
    exists but cannot be parsed, so a missing PyYAML never silently turns the
    approval gate off.
    """
    target = Path(path) if path else REGISTRY_PATH
    if not target.exists():
        return []
    try:
        import yaml

        data = yaml.safe_load(target.read_text(encoding="utf-8")) or {}
    except Exception as exc:  # noqa: BLE001 - reported via PolicyUnavailable
        raise PolicyUnavailable(f"cannot read {target.name}: {type(exc).__name__}: {exc}") from exc
    entries = data.get("workflows") if isinstance(data, dict) else None
    return [e for e in (entries or []) if isinstance(e, dict)]


def _load_or_degrade() -> list[dict[str, Any]]:
    try:
        return load_registry()
    except PolicyUnavailable as exc:
        if strict_policy():
            raise
        print(
            f"[policy] WARNING: {exc}. Running with legacy defaults; "
            "confirm_before_run is NOT enforced. "
            "Install PyYAML or set AGENTZ_POLICY_STRICT=1 to refuse instead.",
            file=sys.stderr,
        )
        return []


def _find_entry(key: str, entries: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    for entry in entries:
        handler = str(entry.get("handler", ""))
        if key in (entry.get("id"), handler) or handler.rsplit(".", 1)[-1] == key:
            return entry
    return None


def _as_tuple(value: Any) -> tuple:
    return tuple(value) if isinstance(value, (list, tuple)) else ()


def policy_for(key: str, entries: Optional[list[dict[str, Any]]] = None) -> WorkflowPolicy:
    """Build the policy for a workflow id or handler name.

    Unknown workflows get today's defaults, so existing runs are unchanged.
    Registry fields used: confirm_before_run, plus the optional risk_class,
    financial_limit_usd, max_attempts and verify.
    """
    pool = _load_or_degrade() if entries is None else entries
    entry = _find_entry(key, pool)
    if entry is None:
        return WorkflowPolicy(workflow_id=key)

    risk = str(entry.get("risk_class", DEFAULT_RISK_CLASS)).lower()
    if risk not in RISK_CLASSES:
        risk = "high"  # fail closed on a typo
    try:
        limit = float(entry.get("financial_limit_usd", DEFAULT_FINANCIAL_LIMIT_USD))
    except (TypeError, ValueError):
        limit = DEFAULT_FINANCIAL_LIMIT_USD
    try:
        attempts = max(1, min(int(entry.get("max_attempts", 1)), 5))
    except (TypeError, ValueError):
        attempts = 1
    return WorkflowPolicy(
        workflow_id=str(entry.get("id", key)),
        handler=str(entry.get("handler", "")),
        risk_class=risk,
        financial_limit_usd=limit,
        requires_human_approval=bool(entry.get("confirm_before_run", False)),
        type=str(entry.get("type", "api")),
        priority=str(entry.get("priority", "medium")),
        blocks_revenue=bool(entry.get("blocks_revenue", False)),
        prerequisites=_as_tuple(entry.get("prerequisites")),
        requires=_as_tuple(entry.get("requires")),
        verify=_as_tuple(entry.get("verify")),
        max_attempts=attempts,
        from_registry=True,
    )


# ---------------------------------------------------------------------------
# Approval queue (append-only JSONL: request / approve / reject / consume)
# ---------------------------------------------------------------------------
def approvals_path() -> Path:
    return state_dir() / "approvals.jsonl"


def _append_event(event: dict[str, Any]) -> None:
    path = approvals_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {"ts": time.time(), **event}
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, sort_keys=True) + "\n")


def _read_events() -> list[dict[str, Any]]:
    path = approvals_path()
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            continue  # a torn line must never authorise anything
        if isinstance(parsed, dict):
            events.append(parsed)
    return events


def list_requests(now: Optional[float] = None) -> list[dict[str, Any]]:
    """Fold the event log into one record per request, with a status field.

    Status is one of pending, approved, rejected, consumed or expired.
    """
    now = time.time() if now is None else now
    records: dict[str, dict[str, Any]] = {}
    for ev in _read_events():
        rid, kind = ev.get("id"), ev.get("event")
        if not rid or not kind:
            continue
        if kind == "request":
            records[rid] = {**ev, "status": "pending"}
        elif rid in records:
            rec = records[rid]
            if kind in ("approve", "reject") and rec["status"] == "pending":
                rec["status"] = "approved" if kind == "approve" else "rejected"
                rec["decided_by"] = ev.get("by", "")
                rec["note"] = ev.get("note", "")
            elif kind == "consume" and rec["status"] == "approved":
                rec["status"] = "consumed"
    for rec in records.values():
        if rec["status"] in ("pending", "approved") and rec.get("expires_at", 0) < now:
            rec["status"] = "expired"
    return sorted(records.values(), key=lambda r: r.get("ts", 0))


def request_approval(
    workflow_id: str,
    mode: str,
    reason: str,
    ttl_hours: float = DEFAULT_APPROVAL_TTL_HOURS,
) -> str:
    """Queue a request (deduplicated while one is pending) and return its id."""
    for rec in list_requests():
        if rec.get("workflow_id") == workflow_id and rec["status"] == "pending":
            return str(rec["id"])
    rid = uuid.uuid4().hex[:12]
    _append_event(
        {
            "event": "request",
            "id": rid,
            "workflow_id": workflow_id,
            "mode": mode,
            "reason": reason,
            "expires_at": time.time() + ttl_hours * 3600,
        }
    )
    return rid


def decide(request_id: str, approved: bool, by: str = "human", note: str = "") -> bool:
    """Approve or reject a pending request. False if it is not pending."""
    for rec in list_requests():
        if rec["id"] == request_id and rec["status"] == "pending":
            _append_event(
                {"event": "approve" if approved else "reject", "id": request_id, "by": by, "note": note}
            )
            return True
    return False


def consume_approval(workflow_id: str) -> bool:
    """Spend one approval for this workflow (single-use). True if one existed."""
    for rec in list_requests():
        if rec.get("workflow_id") == workflow_id and rec["status"] == "approved":
            _append_event({"event": "consume", "id": rec["id"]})
            return True
    return False
