"""Geographic review evidence must not become a persistent authenticity sanction."""
import asyncio
from unittest.mock import MagicMock
from agentz.core import trust


def _db(rows, *, fail=False):
    db=MagicMock()
    tbl=db.table.return_value
    tbl.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "qron_id": 7, "metadata": {"target_market":"US"}, "authenticity_score": 99.0
    }
    tbl.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"scanned_at":"2026-11-01T00:00:00Z","city":"Detroit","country":"US"}
    ]
    geo=tbl.select.return_value.eq.return_value.execute
    if fail:
        geo.side_effect=RuntimeError("secret_key_DO_NOT_LEAK")
    else:
        geo.return_value.data=rows
    return db


def test_review_candidate_does_not_downgrade_score_or_mark_counterfeit():
    db=_db([{"country":"CA","city":"Toronto"} for _ in range(3)])
    out=asyncio.run(trust.assess_scans(db,"product-1",signature_valid=True))
    assert out["verified"] is False
    assert out["checks"]["location"] == "anomaly"
    assert out["score"] == 99.0
    payload=db.table.return_value.update.call_args.args[0]
    assert payload["authenticity_score"]==99.0
    assert "security_flag" not in payload["metadata"]
    assert "geo_alert" not in payload["metadata"]


def test_database_failure_does_not_expose_backend_secret(caplog):
    db=_db([],fail=True)
    geo=asyncio.run(trust.detect_geospatial_anomalies(db,7,expected_region="US"))
    assert geo["error"] is True
    assert geo["anomaly"] is None
    assert "secret_key_DO_NOT_LEAK" not in str(geo)
    assert "secret_key_DO_NOT_LEAK" not in caplog.text
