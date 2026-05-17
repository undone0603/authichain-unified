from pathlib import Path
import textwrap
from agentz.core.grants_pipeline import load_pursue_list

def test_load_pursue_list_parses_csv(tmp_path: Path):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            abc123,Sample Title,DOD,2030-01-01T00:00:00-04:00,85
            def456,Another,NIH,2030-02-01T00:00:00-04:00,60
            """
        ),
        encoding="utf-8",
    )

    rows = load_pursue_list(csv)

    assert len(rows) == 2
    assert rows[0]["notice_id"] == "abc123"
    assert rows[0]["fit_score"] == 85  # coerced to int
    assert rows[1]["fit_score"] == 60


from datetime import datetime, timezone
from agentz.core.grants_pipeline import qualified_opportunities


def _write_csv(tmp_path: Path, body: str) -> Path:
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(textwrap.dedent(body), encoding="utf-8")
    return csv


def test_qualified_opportunities_filters_by_fit_and_deadline(tmp_path: Path):
    csv = _write_csv(
        tmp_path,
        """\
        notice_id,title,agency,deadline,fit_score
        high_future,Good,DOD,2099-01-01T00:00:00-04:00,85
        low_future,Low,DOD,2099-01-01T00:00:00-04:00,40
        high_past,Stale,DOD,2000-01-01T00:00:00-04:00,90
        """,
    )

    now = datetime(2026, 5, 16, tzinfo=timezone.utc)
    out = qualified_opportunities(csv, now=now, min_fit=80)

    notice_ids = [o["notice_id"] for o in out]
    assert notice_ids == ["high_future"]


def test_qualified_opportunities_sorts_descending_by_fit(tmp_path: Path):
    csv = _write_csv(
        tmp_path,
        """\
        notice_id,title,agency,deadline,fit_score
        a,A,DOD,2099-01-01T00:00:00-04:00,85
        b,B,DOD,2099-01-01T00:00:00-04:00,95
        c,C,DOD,2099-01-01T00:00:00-04:00,85
        """,
    )

    now = datetime(2026, 5, 16, tzinfo=timezone.utc)
    out = qualified_opportunities(csv, now=now, min_fit=80)

    assert [o["notice_id"] for o in out] == ["b", "a", "c"]


from agentz.core.grants_pipeline import (
    read_ledger,
    update_status,
    status_of,
    LEDGER_STATUSES,
)


def test_ledger_is_empty_when_missing(tmp_path: Path):
    ledger_path = tmp_path / "pipeline_ledger.json"
    assert read_ledger(ledger_path) == {}
    assert status_of("never_seen", ledger_path) is None


def test_update_status_persists_and_round_trips(tmp_path: Path):
    ledger_path = tmp_path / "pipeline_ledger.json"

    update_status(
        "abc123",
        "drafted",
        ledger_path=ledger_path,
        title="Sample",
        agency="DOD",
    )

    assert status_of("abc123", ledger_path) == "drafted"
    data = read_ledger(ledger_path)
    assert data["abc123"]["status"] == "drafted"
    assert data["abc123"]["title"] == "Sample"
    assert "history" in data["abc123"]
    assert data["abc123"]["history"][-1]["status"] == "drafted"


def test_update_status_rejects_unknown_status(tmp_path: Path):
    import pytest
    with pytest.raises(ValueError):
        update_status("abc", "bogus", ledger_path=tmp_path / "x.json")


def test_ledger_statuses_constant():
    assert LEDGER_STATUSES == ("drafted", "reviewed", "submitted", "won", "lost")


import asyncio
import agentz.core.grants_pipeline as gp
import agentz.core.grants as grants


def test_scout_uses_pipeline_loader(tmp_path: Path, monkeypatch):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            real_one,Real Opportunity,DOD,2099-01-01T00:00:00-04:00,90
            mock_dead,Dead,DOD,2000-01-01T00:00:00-04:00,90
            """
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)

    out = asyncio.run(grants.scout_grant_opportunities(ctx=None))

    notice_ids = [o["notice_id"] for o in out]
    assert "real_one" in notice_ids
    assert "dla-secure-logistics" not in notice_ids
    assert "nih-counterfeit-detection" not in notice_ids
