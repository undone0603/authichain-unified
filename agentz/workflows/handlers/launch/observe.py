"""
agentz.workflows.handlers.launch.observe
-----------------------------------------
Observation phase: gather operational context from the system.
Checks deployment health, DB migrations, credential status, and
recent audit log metrics.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.runner import DEFAULT_AUDIT_LOG
from agentz.core.supervisor import Supervisor


def run(ctx: ExecutionContext) -> str:
    """Gather and report operational observations."""
    ctx.step("Observing system state")

    findings = []

    # Audit log metrics
    supervisor = Supervisor(log_path=DEFAULT_AUDIT_LOG)
    metrics = supervisor.analyze()
    total_workflows = len(metrics)
    failing = sum(
        1 for m in metrics.values()
        if m.runs > 0 and m.failures / m.runs > 0.3
    )
    if total_workflows > 0:
        findings.append(f"{total_workflows} workflows tracked, {failing} failing")

    # Credential preflight — critical launch-gate keys only
    from agentz.core.credentials import CRITICAL_CREDS, credential_snapshot
    snap = credential_snapshot()
    missing = snap["missing_credentials"]
    if missing:
        findings.append(
            f"Missing critical credentials: {len(missing)} of {len(CRITICAL_CREDS)}"
            f" ({', '.join(missing)})"
        )
    else:
        findings.append(f"All {len(CRITICAL_CREDS)} critical credentials present")

    # Health checks (non-blocking)
    if ctx.mode != Mode.DRY_RUN:
        try:
            from agentz.core.health import run_diagnostics
            import asyncio
            diagnostics = asyncio.run(run_diagnostics())
            llm_status = diagnostics.get("llm", {}).get("status", "unknown")
            sb_status = diagnostics.get("supabase", {}).get("status", "unknown")
            findings.append(f"LLM: {llm_status}, Supabase: {sb_status}")
        except Exception as e:
            findings.append(f"Health check error: {e}")
    else:
        findings.append("Health checks skipped (dry-run)")

    summary = "; ".join(findings)
    return f"OBSERVE: {summary}"
