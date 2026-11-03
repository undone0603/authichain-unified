"""AgentZ read-only negotiation drafts. No counterpart messaging, orders or payments."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
CLI = ROOT / "tools" / "negotiate" / "cli.mjs"


def run(ctx) -> str:
    params = getattr(ctx, "parameters", {}) or {}
    brief = params.get("negotiation")
    if not isinstance(brief, dict):
        return "INPUT_REQUIRED: provide a bounded negotiation object; no action performed"
    if not CLI.is_file():
        return "UNAVAILABLE: offline negotiation CLI missing; no action performed"
    payload = json.dumps(brief, separators=(",", ":"), ensure_ascii=False)
    if len(payload.encode("utf-8")) > 16 * 1024:
        return "INVALID_INPUT: brief over 16 KiB; no action performed"
    process = subprocess.run(
        ["node", str(CLI)],
        input=payload, text=True, capture_output=True,
        timeout=10, check=False
    )
    if process.returncode != 0:
        return "INVALID_INPUT: negotiation constraints rejected; no action performed"
    result = json.loads(process.stdout)
    if (result.get("decision") != "NO_AGREEMENT_OR_AUTHORIZATION"
        or result.get("sideEffectsPerformed") != 0
        or result.get("allowedActions", {}).get("purchase") is not False):
        return "SAFETY_HOLD: unexpected engine output; no action performed"
    return (
        "PROPOSALS_ONLY: "
        f"options={len(result.get('proposals', []))}; "
        f"outside_option_declared={result.get('batna', {}).get('declared', False)}; "
        "no supplier contacted, no contract, no purchase or payment"
    )
