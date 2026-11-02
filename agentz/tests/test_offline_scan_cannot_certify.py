"""Offline signatures must not authorize a product claim or QRON reward."""
from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from agentz.core import trust


def _db():
    db = MagicMock()
    table = db.table.return_value
    table.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "qron_id": 7,
        "metadata": {"target_market": "US"},
        "authenticity_score": 100.0,
    }
    table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"scanned_at": "2026-11-01T00:00:00Z", "city": "Detroit", "country": "US"},
    ]
    table.select.return_value.eq.return_value.execute.return_value.data = [
        {"country": "US"} for _ in range(3)
    ]
    return db


def test_even_checked_offline_signature_cannot_certify_physical_goods():
    db = _db()
    result = asyncio.run(trust.assess_scans(db, "prod-1", signature_valid=True))
    assert result["checks"]["signature"] == "valid"
    assert result["checks"]["location"] == "clear"
    assert result["checks"]["canonical_registry"] == "not_checked"
    assert result["verified"] is False
    updated = db.table.return_value.update.call_args.args[0]
    assert updated["metadata"]["timeline"][-1]["event"] == "Unverified Scan"


def test_unchecked_offline_signature_is_never_positive():
    result = asyncio.run(trust.assess_scans(_db(), "prod-1"))
    assert result["verified"] is False
    assert result["checks"]["signature"] == "not_checked"


def test_invalid_offline_signature_cannot_certify():
    result = asyncio.run(trust.assess_scans(_db(), "prod-1", signature_valid=False))
    assert result["verified"] is False
    assert result["checks"]["signature"] == "invalid"
