"""Geolocation observations are not authenticity evidence; missing scope is unknown."""
import asyncio
from unittest.mock import MagicMock
from agentz.core.trust import assess_scans, detect_geospatial_anomalies


def db(rows):
    sb = MagicMock()
    t = sb.table.return_value
    t.select.return_value.eq.return_value.execute.return_value.data = rows
    t.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"scanned_at":"2026-11-01T00:00:00Z", "city":"Detroit", "country":"US"}
    ]
    t.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "qron_id":7,"metadata":{"target_market":"US"},"authenticity_score":100
    }
    return sb


def check(db_value, *, expected="US"):
    return asyncio.run(detect_geospatial_anomalies(db_value, 7, expected_region=expected))


def test_missing_market_never_infers_us_or_queries_database():
    sb = db([{"country":"CA"}] * 6)
    r = check(sb, expected=None)
    assert r["anomaly"] is None and r["checked"] is False
    sb.table.assert_not_called()


def test_missing_country_is_unknown_not_counterfeit():
    r=check(db([{"country": None}, {"country": "CA"}, {"country": "CA"}, {"country": "CA"}]))
    assert r["anomaly"] is None and r["checked"] is False


def test_empty_results_is_unknown_not_clear():
    assert check(db([]))["checked"] is False
    assert check(db(None))["anomaly"] is None


def test_case_and_whitespace_normalized():
    r=check(db([{"country":" US "},{"country":"us"},{"country":"Us"}]))
    assert r["checked"] is True and r["anomaly"] is False


def test_three_distinct_scans_outside_declared_market_are_review_only():
    r=check(db([{"country":"CA"}]*3))
    assert r["anomaly"] is True and r["checked"] is True
    assert "counterfeit" not in r["reason"].lower()


def test_assessment_missing_market_remains_unknown_and_not_verified():
    sb=db([{"country":"CA"}]*3)
    sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "qron_id":7,"metadata":{},"authenticity_score":100
    }
    out=asyncio.run(assess_scans(sb, "p1", signature_valid=True))
    assert out["checks"]["location"] == "unknown"
    assert out["verified"] is False
