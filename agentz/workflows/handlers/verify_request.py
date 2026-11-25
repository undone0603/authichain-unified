"""verify_request: end-to-end read-only verification through approved hosted tools.

Parameters (JSON): one or more of record_id, record (+ optional anchor), asset_id.

dry-run: validates the request and returns the plan. No network, no receipt.
confirm/auto: runs the plan against the hosted MCP server and appends the
receipt to agentz/logs/verification-receipts.jsonl (local, gitignored). Never
signs, pays, or writes to production.
"""
from __future__ import annotations

import json
from pathlib import Path

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.verification_workflow import digest, plan, run_verification, validate_request
from agentz.integrations.authichain_mcp import CapabilityError, HostedMCPClient, load_registry

RECEIPTS_PATH = Path("agentz/logs/verification-receipts.jsonl")


def run(ctx: ExecutionContext) -> str:
    params = dict(ctx.parameters or {})
    receipts_path = Path(params.pop("_receipts_path", RECEIPTS_PATH))
    try:
        request = validate_request(params)
        if ctx.mode == Mode.DRY_RUN:
            return json.dumps({
                "mode": "dry-run",
                "request_digest": digest(request),
                "plan": [cid for cid, _ in plan(request)],
                "network": False,
            })
        receipt = run_verification(HostedMCPClient(load_registry()), request)
    except CapabilityError as exc:
        return json.dumps(exc.as_dict())
    receipts_path.parent.mkdir(parents=True, exist_ok=True)
    with receipts_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(receipt, sort_keys=True) + "\n")
    return json.dumps(receipt)
