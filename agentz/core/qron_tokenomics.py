"""Simulated $QRON fiat-obligation math.

Mirrors src/lib/qron-tokenomics.ts. Does not trade, burn, or transfer.
Live supply is 1_000_000_000. The 100_000_000 govchain figure is theater.
Burn is 25% of the fiat dollar. 40/30/15/15 splits only the remaining 75%.
"""

from __future__ import annotations

LIVE_QRON_SUPPLY = 1_000_000_000
THEATER_SUPPLY_DO_NOT_USE = 100_000_000
FIAT_BURN_RATE = 0.25
SUPPLY_SPLIT = {
    "treasury": 0.40,
    "node_operators": 0.30,
    "core_contributors": 0.15,
    "ecosystem_grants": 0.15,
}


def compute_revenue_obligations(amount_fiat_usd: float) -> dict:
    if amount_fiat_usd < 0:
        raise ValueError("amount_fiat_usd must be non-negative")
    cents = int(round(amount_fiat_usd * 100))
    burn = int(round(cents * FIAT_BURN_RATE))
    rest = cents - burn
    treasury = int(round(rest * SUPPLY_SPLIT["treasury"]))
    nodes = int(round(rest * SUPPLY_SPLIT["node_operators"]))
    core = int(round(rest * SUPPLY_SPLIT["core_contributors"]))
    grants = rest - treasury - nodes - core
    total = burn + treasury + nodes + core + grants
    if total != cents:
        raise RuntimeError(f"obligation sum {total} != {cents}")
    return {
        "amount_cents": cents,
        "burn_cents": burn,
        "treasury_cents": treasury,
        "node_operators_cents": nodes,
        "core_contributors_cents": core,
        "ecosystem_grants_cents": grants,
        "settles_on_chain": False,
        "autonomy_enabled": False,
        "live_supply": LIVE_QRON_SUPPLY,
    }
