"""AgentZ aerospace screening: safe local synthetic tests, no production side effects.

No live source data, credentials, payments, web calls, external messaging, or flight approval.
"""
from __future__ import annotations
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
TEST_FILE = ROOT / "scripts" / "ci" / "aerospace-acceptance.test.mjs"

def test_local_gate() -> dict[str, object]:
    node = shutil.which("node")
    if not node or not TEST_FILE.is_file():
        return {"ok": False, "reason": "node_or_test_missing"}
    env = {"PATH": os.path.dirname(node), "HOME": "/nonexistent"}
    try:
        run = subprocess.run(
            [node, "--test", str(TEST_FILE)],
            cwd=str(ROOT), env=env, text=True, capture_output=True,
            check=False, timeout=45,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "reason": "local_test_timeout"}
    return {"ok": run.returncode == 0, "status": "passed" if run.returncode == 0 else "failed", "exit_code": run.returncode}

def run(ctx: Any) -> dict[str, str]:
    mode = getattr(getattr(ctx, "mode", None), "value", "")
    if mode == "dry-run":
        return {"status": "skipped", "notes": "Would execute local synthetic aerospace test matrix only; no network/payment/customer contact"}
    if mode != "confirm":
        return {"status": "blocked", "notes": "Aerospace pilot is opt-in confirm-only"}
    result = ctx.step("Run isolated aerospace pre-acceptance synthetic tests", action=test_local_gate)
    if result is None:
        return {"status": "skipped", "notes": "Operator declined test"}
    return {"status": "ok" if result["ok"] else "failed", "notes": "Local aerospace gate: " + str(result)}
