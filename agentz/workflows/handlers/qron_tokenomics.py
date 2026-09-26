"""Simulated $QRON obligation workflow.

Records the fiat split. Refuses any request to buy, burn, or transfer.
"""

from __future__ import annotations

import json

from agentz.core.modes import ExecutionContext
from agentz.core.qron_tokenomics import compute_revenue_obligations


def run(ctx: ExecutionContext) -> str:
    params = ctx.parameters or {}
    if params.get("autonomy_enabled") is True or params.get("simulated_burn") is False:
        raise RuntimeError(
            "refusing on-chain $QRON buyback or burn; autonomy stays off"
        )
    amount = float(params.get("amount_fiat_usd") or 0)
    row = compute_revenue_obligations(amount)
    ctx.save_state(row)
    return json.dumps(row)
