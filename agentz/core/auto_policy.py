"""One AgentZ auto decision. Fail closed if the resolver cannot be read."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_GATE = _ROOT / "scripts" / "autonomy" / "agentz-auto-gate.mjs"


def consult_agentz_policy(mode: str) -> dict:
    try:
        proc = subprocess.run(
            ["node", str(_GATE), mode],
            cwd=str(_ROOT),
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {
            "allowed": False,
            "reason": f"authority resolver unreachable: {exc}",
            "class": "FROZEN",
        }
    if proc.returncode not in (0, 3):
        return {
            "allowed": False,
            "reason": "authority resolver unreachable",
            "class": "FROZEN",
        }
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {
            "allowed": False,
            "reason": "authority resolver returned no decision",
            "class": "FROZEN",
        }
    if data.get("allowed") is not True:
        data["allowed"] = False
    return data
