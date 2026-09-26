"""Nothing AgentZ can't back with data or a real transaction may read as real:
/results carries no invented figures, and the $QRON reward and redemption
paths say they are simulated."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

import agentz.api.main as api
from agentz.core.growth import reward_repeat_scans
from agentz.core.redemption import burn_qron_for_discount


def test_results_has_no_hard_coded_figures():
    body = TestClient(api.app).get("/results").json()
    assert "total_active_deals" not in body
    assert "potential_arr" not in body
    assert body["report_count"] == len(body["reports"])
    assert body["agreement_count"] == len(body["agreements"])


def test_scan_reward_is_labelled_simulated():
    reward = asyncio.run(reward_repeat_scans(MagicMock(), "0xabc", None))
    assert reward["simulated"] is True


def test_redemption_is_labelled_simulated():
    res = asyncio.run(burn_qron_for_discount(MagicMock(), "0xabc", 50.0, "biz-1"))
    assert res["simulated"] is True
    assert res["balance_checked"] is False
