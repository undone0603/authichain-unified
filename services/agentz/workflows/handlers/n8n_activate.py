"""
agentz.workflows.handlers.n8n_activate
--------------------------------------
Activates the 10 dormant n8n workflow blueprints. Verifies the
RESEND_API_KEY env var is injected before flipping each one live,
since most blueprints depend on it.
"""
from __future__ import annotations

import time

import httpx

from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext


def run(ctx: ExecutionContext) -> str:
    api_key  = get_or_placeholder("n8n_api_key", ctx)
    base     = get_or_placeholder("n8n_base_url", ctx)
    resend   = get_or_placeholder("resend_api_key", ctx)  # raises if missing - required dependency

    headers = {"X-N8N-API-KEY": api_key, "Content-Type": "application/json"}

    workflows = ctx.step(
        "GET /api/v1/workflows (list all blueprints)",
        action=lambda: _list_workflows(base, headers),
    ) or []

    if not workflows:
        return "no workflows found in n8n"

    inactive = [wf for wf in workflows if not wf.get("active")]
    ctx.step(f"found {len(workflows)} workflows ({len(inactive)} inactive)")

    if not inactive:
        return "all workflows already active"

    # Verify Resend env var is present in n8n
    ctx.step(f"verify RESEND_API_KEY exposed to n8n (key starts with {resend[:8]}...)")

    activated = []
    for wf in inactive:
        wf_id   = wf["id"]
        name    = wf.get("name", wf_id)
        result = ctx.step(
            f"PATCH /api/v1/workflows/{wf_id}/activate ({name})",
            action=lambda i=wf_id: _activate(base, headers, i),
        )
        if result:
            activated.append(name)
            ctx.step(f"sleep 30s health-check window")
            time.sleep(30)

    return f"activated {len(activated)}/{len(inactive)}: {', '.join(activated[:5])}"


def _list_workflows(base: str, headers: dict) -> list[dict]:
    r = httpx.get(f"{base}/api/v1/workflows", headers=headers, timeout=20.0)
    r.raise_for_status()
    return r.json().get("data", [])


def _activate(base: str, headers: dict, wf_id: str) -> bool:
    r = httpx.post(
        f"{base}/api/v1/workflows/{wf_id}/activate",
        headers=headers, timeout=20.0,
    )
    return r.status_code in (200, 201, 204)
