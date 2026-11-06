"""AgentZ registry handler for read-only public AuthiChain AgentCard preflight."""
from __future__ import annotations

import os

from agentz.core.modes import Mode
from agentz.integrations.a2a_card_preflight import CARD_URL, probe_live


def run(ctx):
    # CLI globally forbids AUTO; permit only explicit, attended CONFIRM mode,
    # plus a second opt-in gate. Never use a wallet or execute A2A tasks.
    if ctx.mode != Mode.CONFIRM or os.environ.get("AGENTZ_A2A_CARD_PREFLIGHT_LIVE") != "true":
        return {"agent": "AgentZ", "state": "dry_run", "target": CARD_URL,
                "network_called": False, "payment": False, "task_invoked": False}
    return probe_live()
