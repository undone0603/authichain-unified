"""
Claw ↔ AgentZ execution-mode contract.

FastAPI treats bare `mode: str = "dry-run"` as a *query* param, so a claw
POST body `{ "mode": "confirm" }` was ignored and every chat `run` stayed
dry-run. Resolve mode from query first, then JSON body, then default
dry-run.

Architect and cold-email workflows stay dry-run unless the caller sets an
explicit live flag (`?live=true` or `{ "live": true }`).
"""

from __future__ import annotations

from typing import Any, Mapping

VALID_MODES = ("dry-run", "confirm", "auto")
DEFAULT_MODE = "dry-run"


def is_fail_closed_workflow(workflow_id: str | None, endpoint: str = "workflow") -> bool:
    if endpoint == "architect":
        return True
    if not workflow_id:
        return False
    wid = workflow_id.strip().lower()
    return wid == "architect_cycle" or "email" in wid


def _as_bool(value: Any) -> bool:
    if value is True:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def resolve_execution_mode(
    *,
    query_mode: str | None = None,
    body: Mapping[str, Any] | None = None,
    live_query: Any = False,
    workflow_id: str | None = None,
    endpoint: str = "workflow",
) -> tuple[str, bool, bool]:
    """Return (mode, coerced_to_dry_run, live).

    Query `mode` wins over JSON `mode`. Invalid values fall back to dry-run.
    Fail-closed surfaces (architect / *email*) ignore confirm/auto unless
    `live` is explicitly true.
    """
    payload = body if isinstance(body, Mapping) else {}
    live = _as_bool(live_query) or _as_bool(payload.get("live"))

    requested = (query_mode or "").strip() or str(payload.get("mode") or "").strip()
    if requested not in VALID_MODES:
        requested = DEFAULT_MODE

    fail_closed = is_fail_closed_workflow(workflow_id, endpoint)
    if fail_closed and requested != DEFAULT_MODE and not live:
        return DEFAULT_MODE, True, live
    # ?live=true with no explicit mode means run, except fail-closed
    # surfaces (architect / *email*) which still default dry-run.
    mode_was_omitted = not (query_mode or "").strip() and not str(
        payload.get("mode") or ""
    ).strip()
    if live and mode_was_omitted and not fail_closed:
        return "auto", False, live
    return requested, False, live
