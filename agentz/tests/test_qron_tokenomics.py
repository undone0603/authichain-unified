from agentz.core.qron_tokenomics import (
    LIVE_QRON_SUPPLY,
    THEATER_SUPPLY_DO_NOT_USE,
    compute_revenue_obligations,
)
from agentz.workflows.handlers.qron_tokenomics import run
from agentz.core.modes import ExecutionContext, Mode


def test_live_supply_is_one_billion():
    assert LIVE_QRON_SUPPLY == 1_000_000_000
    assert THEATER_SUPPLY_DO_NOT_USE == 100_000_000


def test_hundred_dollars_sums_to_the_dollar():
    row = compute_revenue_obligations(100)
    assert row["burn_cents"] == 2500
    assert (
        row["burn_cents"]
        + row["treasury_cents"]
        + row["node_operators_cents"]
        + row["core_contributors_cents"]
        + row["ecosystem_grants_cents"]
        == 10000
    )
    assert row["settles_on_chain"] is False


def test_handler_refuses_a_live_burn():
    ctx = ExecutionContext(
        mode=Mode.DRY_RUN,
        workflow_id="qron_tokenomics_sim",
        parameters={"simulated_burn": False, "amount_fiat_usd": 10},
    )
    try:
        run(ctx)
    except RuntimeError as exc:
        assert "refusing" in str(exc)
    else:
        raise AssertionError("live burn was not refused")
