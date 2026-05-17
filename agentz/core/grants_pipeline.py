"""
agentz.core.grants_pipeline
---------------------------
CSV loader and pipeline ledger for federal grant opportunities (Phase 6).
"""
from __future__ import annotations
import csv
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = REPO_ROOT / "gov_pursue_list.csv"


def load_pursue_list(csv_path: Path | str = DEFAULT_CSV) -> list[dict[str, Any]]:
    """Return all rows from the pursue list with fit_score coerced to int."""
    path = Path(csv_path)
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows: list[dict[str, Any]] = []
        for row in reader:
            try:
                row["fit_score"] = int(row.get("fit_score") or 0)
            except (TypeError, ValueError):
                row["fit_score"] = 0
            rows.append(row)
    return rows
