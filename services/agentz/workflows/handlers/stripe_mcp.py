"""
agentz.workflows.handlers.stripe_mcp
------------------------------------
Validates Stripe key and runs a read-only smoke-test against
acct_1SXIyEGqTruSqV8T. Reports MCP-server liveness for downstream
Claude.ai connector reconnect.
"""
from __future__ import annotations

import httpx

from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext

ACCOUNT_ID = "acct_1SXIyEGqTruSqV8T"


def run(ctx: ExecutionContext) -> str:
    key = get_or_placeholder("stripe_secret", ctx)
    headers = {"Authorization": f"Bearer {key}"}

    # Smoke test 1: account info
    acct = ctx.step(
        "GET /v1/account (verify key + account match)",
        action=lambda: _stripe_get("/v1/account", headers),
    )
    if not acct:
        return "skipped (dry-run or no result)"

    if acct.get("id") != ACCOUNT_ID:
        return f"WARNING: key resolves to {acct.get('id')}, expected {ACCOUNT_ID}"

    # Smoke test 2: recent charges
    charges = ctx.step(
        "GET /v1/charges?limit=3 (recent activity)",
        action=lambda: _stripe_get("/v1/charges?limit=3", headers),
    ) or {}
    n = len(charges.get("data", []))

    # Smoke test 3: webhook endpoints health
    hooks = ctx.step(
        "GET /v1/webhook_endpoints (verify configured webhooks present)",
        action=lambda: _stripe_get("/v1/webhook_endpoints", headers),
    ) or {}
    hook_count = len(hooks.get("data", []))

    ctx.step(
        "MCP reconnect: open Claude.ai > Settings > Connectors > Stripe > Reconnect",
    )

    return f"key OK, {n} recent charges, {hook_count} webhooks configured"


def _stripe_get(path: str, headers: dict) -> dict:
    r = httpx.get(f"https://api.stripe.com{path}", headers=headers, timeout=20.0)
    r.raise_for_status()
    return r.json()
