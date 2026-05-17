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


from datetime import datetime, timezone


def _parse_deadline(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def qualified_opportunities(
    csv_path: Path | str = DEFAULT_CSV,
    *,
    now: datetime | None = None,
    min_fit: int = 80,
) -> list[dict[str, Any]]:
    """Return rows with fit_score >= min_fit and deadline strictly in the future, sorted by fit_score desc (stable)."""
    cutoff = now or datetime.now(timezone.utc)
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=timezone.utc)

    rows = load_pursue_list(csv_path)
    out: list[dict[str, Any]] = []
    for row in rows:
        if row["fit_score"] < min_fit:
            continue
        deadline = _parse_deadline(row.get("deadline", ""))
        if deadline is None:
            continue
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if deadline <= cutoff:
            continue
        out.append(row)

    out.sort(key=lambda r: r["fit_score"], reverse=True)
    return out
