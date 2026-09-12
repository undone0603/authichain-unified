"""
agentz.workflows.handlers.revenue_cycle
---------------------------------------
Warm-lead checkout CTAs + dunning ping + revenue health report.

Prefers the TypeScript executor (`scripts/revenue-cycle.ts`) via pnpm/tsx.
Falls back to a Python Stripe+Supabase report when Node is unavailable.
Does not cold-email guessed addresses.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from agentz.core.credentials import get
from agentz.core.modes import ExecutionContext, Mode

_HERE = Path(__file__).resolve()
def _find_repo_root() -> Path:
    for parent in _HERE.parents:
        if (parent / "scripts" / "revenue-cycle.ts").is_file():
            return parent
    # services/agentz/workflows/handlers → repo is parents[3]
    return _HERE.parents[3]

REPO_ROOT = _find_repo_root()
SCRIPT = REPO_ROOT / "scripts" / "revenue-cycle.ts"


def _is_dry(ctx: ExecutionContext) -> bool:
    mode = ctx.mode
    if mode == Mode.DRY_RUN:
        return True
    return str(mode) in ("dry-run", "Mode.DRY_RUN")


def _python_report(ctx: ExecutionContext) -> str:
    """Fallback report when pnpm/tsx is not on PATH."""
    lines = ["💰 REVENUE CYCLE HEALTH REPORT (python fallback)"]
    lines.append(f"mode={'DRY_RUN' if _is_dry(ctx) else 'LIVE'}")

    ctx.step("Fetching Supabase lead/proposal snapshot...")
    try:
        supa_url = get("supabase_url")
        supa_key = get("supabase_service_key", required=False) or get("supabase_anon")
        headers = {"apikey": supa_key, "Authorization": f"Bearer {supa_key}"}
        r = httpx.get(
            f"{supa_url}/rest/v1/leads?select=status,metadata&limit=2000",
            headers=headers,
            timeout=15,
        )
        leads = r.json() if r.status_code == 200 else []
        by_status: dict[str, int] = {}
        with_pay = 0
        for lead in leads if isinstance(leads, list) else []:
            st = str(lead.get("status") or "unknown")
            by_status[st] = by_status.get(st, 0) + 1
            meta = lead.get("metadata") or {}
            if isinstance(meta, dict) and (meta.get("paymentLink") or meta.get("checkoutUrl")):
                with_pay += 1
        top = ", ".join(
            f"{k}={v}" for k, v in sorted(by_status.items(), key=lambda kv: -kv[1])[:8]
        )
        lines.append(f"Leads sampled: {len(leads) if isinstance(leads, list) else 0}")
        lines.append(f"  by status: {top or 'n/a'}")
        lines.append(f"  with paymentLink in metadata: {with_pay}")
    except Exception as exc:  # noqa: BLE001 — report must not crash the workflow
        lines.append(f"Supabase: failed ({exc})")

    ctx.step("Fetching Stripe charges (30d)...")
    try:
        stripe_key = get("stripe_secret", required=False)
        if not stripe_key:
            lines.append("Stripe: stripe_secret not configured")
        else:
            since = int(time.time()) - 30 * 24 * 60 * 60
            r = httpx.get(
                f"https://api.stripe.com/v1/charges?created[gte]={since}&limit=100",
                headers={"Authorization": f"Bearer {stripe_key}"},
                timeout=15,
            )
            charges = r.json().get("data", []) if r.status_code == 200 else []
            paid = [c for c in charges if c.get("paid") and not c.get("refunded")]
            total = sum(c.get("amount", 0) for c in paid) / 100
            lines.append(f"Stripe charges (30d, ≤100): ${total:,.2f} ({len(paid)} paid)")
    except Exception as exc:  # noqa: BLE001
        lines.append(f"Stripe: failed ({exc})")

    lines.append(f"Generated: {datetime.now(timezone.utc).isoformat()}")
    report = "\n".join(lines)
    print(report)
    return report


def _run_ts(ctx: ExecutionContext, phase: str, dry: bool) -> str:
    env = os.environ.copy()
    env["DRY_RUN"] = "true" if dry else "false"
    # Map AgentZ credential aliases into the script's env names when present.
    for cred_key, env_key in (
        ("supabase_url", "SUPABASE_URL"),
        ("supabase_service_key", "SUPABASE_SERVICE_ROLE_KEY"),
        ("stripe_secret", "STRIPE_SECRET_KEY"),
    ):
        try:
            val = get(cred_key, required=False)
        except Exception:  # noqa: BLE001
            val = None
        if val and not env.get(env_key):
            env[env_key] = val

    cmd = ["pnpm", "exec", "tsx", str(SCRIPT), f"--phase={phase}"]
    ctx.step(f"Executing: {' '.join(cmd)} (DRY_RUN={env['DRY_RUN']})")
    proc = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )
    out = (proc.stdout or "") + (("\n" + proc.stderr) if proc.stderr else "")
    if out.strip():
        print(out)
    if proc.returncode != 0 and not dry:
        raise RuntimeError(f"revenue-cycle.ts exited {proc.returncode}")
    return out.strip() or f"revenue_cycle phase={phase} dry={dry} rc={proc.returncode}"


def run(ctx: ExecutionContext) -> str:
    dry = _is_dry(ctx)
    phase = os.environ.get("REVENUE_CYCLE_PHASE", "all")
    if phase not in ("all", "proposals", "dunning", "report", "checkout-links"):
        phase = "all"

    if dry:
        ctx.step(
            "dry-run plan: checkout-links (verified warm leads) → "
            "proposals (stamp CTAs / flag closer) → dunning POST → revenue report"
        )

    if SCRIPT.is_file() and shutil.which("pnpm"):
        try:
            return _run_ts(ctx, phase, dry)
        except Exception as exc:  # noqa: BLE001
            ctx.step(f"TS executor failed ({exc}); falling back to Python report")
            return _python_report(ctx)

    ctx.step("pnpm/tsx unavailable — running Python Stripe+Supabase report only")
    return _python_report(ctx)
