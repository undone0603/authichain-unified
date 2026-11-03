"""AgentZ audit-only StrainChain first-buyer workflow.

Reads ONLY operator-provided evidence; calls the offline Node evidence gate.
It does not query Gmail/Stripe, send outreach, charge, mint, publish, grant,
refund, or update a state store. External verification is a separate task.
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CLI = ROOT / "tools" / "strainchain-first-sale" / "cli.mjs"


def run(ctx: Any) -> str:
    params = getattr(ctx, "parameters", {}) or {}
    evidence = params.get("evidence", {})
    if not isinstance(evidence, dict):
        raise ValueError("evidence must be an object supplied by a trusted operator")
    if not CLI.is_file():
        raise FileNotFoundError("StrainChain first-buyer evidence gate not installed")
    # Private provider/session evidence is passed via stdin and never logged.
    completed = subprocess.run(
        ["node", str(CLI)],
        input=json.dumps(evidence, separators=(",", ":")),
        text=True,
        capture_output=True,
        timeout=12,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError("offline first-buyer gate failed; inspect local setup")
    report = json.loads(completed.stdout)
    missing = ",".join(report.get("next_missing", []))
    return (
        "AUDIT-ONLY; no live action. "
        f"state={report['state']} missing={missing or 'none'} "
        "customer_sale_verified=false automatic_issuance_allowed=false"
    )
