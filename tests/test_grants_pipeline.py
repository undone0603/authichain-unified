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
