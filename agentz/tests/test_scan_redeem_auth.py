"""AgentZ write routes: /scan and /redeem need the operator token, and /scan
only says `verified` when every check actually ran and passed."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import agentz.api.main as api
from agentz.core import trust

SECRET = "test-agent-secret"


def _supabase(*, product=None, scans=None, geo_rows=None, geo_error=False):
    """MagicMock shaped like the supabase-py chains trust.py uses."""
    sb = MagicMock()
    tbl = sb.table.return_value
    tbl.select.return_value.eq.return_value.single.return_value.execute.return_value.data = (
        product
        if product is not None
        else {"qron_id": 7, "metadata": {"target_market": "US"}, "authenticity_score": 100.0}
    )
    tbl.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
        scans
        if scans is not None
        else [{"city": "Detroit", "country": "US", "scanned_at": "2026-09-23T00:00:00Z"}]
    )
    geo = tbl.select.return_value.eq.return_value.execute
    if geo_error:
        geo.side_effect = RuntimeError("scan_events unreachable")
    else:
        geo.return_value.data = geo_rows if geo_rows is not None else [{"country": "US"}] * 3
    return sb


@pytest.fixture
def client():
    sb = _supabase()
    api.app.dependency_overrides[api.get_supabase] = lambda: sb
    try:
        yield TestClient(api.app), sb
    finally:
        api.app.dependency_overrides.clear()


def _secret(value):
    return patch.object(api, "get", lambda key, *a, **k: value if key == "agent_secret" else None)


SCAN = {"product_id": "prod-1", "wallet": "0xabc"}
REDEEM = {"wallet": "0xabc", "amount": 50, "business_id": "biz-1"}


@pytest.mark.parametrize("method,path,kwargs", [
    ("post", "/scan", {"json": SCAN}),
    ("post", "/redeem", {"params": REDEEM}),
])
def test_write_routes_reject_missing_or_wrong_token(client, method, path, kwargs):
    c, sb = client
    with _secret(SECRET):
        assert getattr(c, method)(path, **kwargs).status_code == 401
        bad = {"Authorization": "Bearer authichain-secret"}
        assert getattr(c, method)(path, headers=bad, **kwargs).status_code == 401
    sb.table.assert_not_called()


@pytest.mark.parametrize("path,kwargs", [
    ("/scan", {"json": SCAN}),
    ("/redeem", {"params": REDEEM}),
])
def test_write_routes_fail_closed_without_agent_secret(client, path, kwargs):
    c, sb = client
    with _secret(None):
        # The old fallback string must not open anything.
        r = c.post(path, headers={"Authorization": "Bearer authichain-secret"}, **kwargs)
    assert r.status_code == 503
    sb.table.assert_not_called()


def test_scan_with_token_is_not_verified_and_issues_no_reward(client):
    c, _ = client
    reward = AsyncMock()
    with _secret(SECRET), \
            patch("agentz.core.media.generate_story_mode", AsyncMock(return_value=None)), \
            patch("agentz.core.growth.reward_repeat_scans", reward):
        r = c.post("/scan", json=SCAN, headers={"Authorization": f"Bearer {SECRET}"})
    assert r.status_code == 200
    body = r.json()
    # Score is high, but no signature was checked, so it is not "verified".
    assert body["authenticity_score"] > trust.VERIFIED_THRESHOLD
    assert body["verified"] is False
    assert body["checks"]["signature"] == "not_checked"
    assert body["reward"] is None
    reward.assert_not_called()


def _timeline(sb):
    update = sb.table.return_value.update.call_args[0][0]
    return update["metadata"]["timeline"]


def test_unchecked_signature_is_never_verified():
    sb = _supabase()
    result = asyncio.run(trust.assess_scans(sb, "prod-1"))
    assert result["verified"] is False
    assert result["checks"]["signature"] == "not_checked"
    assert _timeline(sb)[-1]["event"] == "Unverified Scan"


def test_location_check_error_is_not_a_pass():
    sb = _supabase(geo_error=True)
    result = asyncio.run(trust.assess_scans(sb, "prod-1", signature_valid=True))
    assert result["checks"]["location"] == "error"
    assert result["verified"] is False
    assert _timeline(sb)[-1]["event"] == "Unverified Scan"


def test_geo_check_error_reports_error_not_clean():
    sb = _supabase(geo_error=True)
    geo = asyncio.run(trust.detect_geospatial_anomalies(sb, 7))
    assert geo["error"] is True
    assert geo["anomaly"] is None


def test_invalid_signature_zeroes_score():
    sb = _supabase()
    result = asyncio.run(trust.assess_scans(sb, "prod-1", signature_valid=False))
    assert result["score"] == 0.0
    assert result["verified"] is False


def test_all_checks_passing_is_verified():
    sb = _supabase()
    result = asyncio.run(trust.assess_scans(sb, "prod-1", signature_valid=True))
    assert result["checks"] == {"signature": "valid", "location": "clear", "velocity": 1}
    assert result["verified"] is True
    assert _timeline(sb)[-1]["event"] == "Verified Scan"


def test_monitor_scans_still_returns_a_float_for_workflows():
    assert asyncio.run(trust.monitor_scans(_supabase(), "prod-1")) == 100.0
