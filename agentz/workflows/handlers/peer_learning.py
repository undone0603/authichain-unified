"""Offline AgentZ review of curated *public* peer-feedback snapshots.

Never fetches arbitrary URLs, launches a browser, sends messages, spends funds,
updates CRM, or changes a PR. Its output is a candidate learning checkpoint.
"""
from __future__ import annotations

import json
from pathlib import Path

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.peer_learning import learn

SNAPSHOT = Path(__file__).resolve().parents[2] / "learning" / "public_peer_observations.json"
MAX_BYTES = 32 * 1024


def run(ctx: ExecutionContext) -> str:
    if ctx.mode == Mode.DRY_RUN:
        return "AgentZ would triage a bounded local public-review snapshot; no I/O."
    if SNAPSHOT.is_symlink() or not SNAPSHOT.is_file() or SNAPSHOT.stat().st_size > MAX_BYTES:
        raise RuntimeError("AgentZ peer-learning snapshot unavailable or oversized")
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("schema") != "agentz.peer-observations.v1":
        raise ValueError("Unknown AgentZ peer-learning snapshot schema")
    outcome = learn(data.get("observations"))
    ctx.save_state(outcome)
    return (
        "AgentZ triaged public peer feedback as unverified: "
        f"review candidates={outcome['review_candidates']}, "
        f"next={outcome['next_action']}; no outreach or deployment"
    )
