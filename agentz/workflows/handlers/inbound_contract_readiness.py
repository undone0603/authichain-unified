"""AgentZ supplier-side contract *preflight*, never a binding acceptance adapter."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[3]
CLI=ROOT/"tools"/"negotiate"/"inbound-contract-readiness.mjs"

def run(ctx) -> str:
    params=getattr(ctx,"parameters",{}) or {}
    contract=params.get("inboundContract")
    if not isinstance(contract,dict):
        return "HOLD: no exact inbound contract evidence; no agreement accepted"
    payload=json.dumps(contract,separators=(",",":"),ensure_ascii=False)
    if len(payload.encode("utf-8"))>64*1024:
        return "HOLD: oversized contract review; no agreement accepted"
    if not CLI.is_file():
        return "HOLD: contract readiness gate unavailable; no agreement accepted"
    p=subprocess.run(["node",str(CLI)],input=payload,text=True,capture_output=True,timeout=10,check=False)
    if p.returncode!=0:
        return "HOLD: contract gate failed; no agreement accepted"
    report=json.loads(p.stdout)
    if (report.get("accepted") is not False or
        report.get("automaticAcceptanceAuthorized") is not False or
        report.get("automaticSpendAuthorized") is not False or
        report.get("noOutboundFunds") is not True):
        return "HOLD: unsafe contract response; no agreement accepted"
    status=report.get("status")
    remaining=",".join(report.get("missing",[]))
    return (
        f"CONTRACT_PREFLIGHT_ONLY status={status}; "
        f"missing={remaining or 'independent_legal_and_issuer_verification'}; "
        "no signature, no agreement, no vendor payments"
    )
