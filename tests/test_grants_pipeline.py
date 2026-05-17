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
