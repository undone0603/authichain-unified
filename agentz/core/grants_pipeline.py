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


import json

LOGS_DIR = Path(__file__).resolve().parents[1] / "logs" / "grants"
DEFAULT_LEDGER = LOGS_DIR / "pipeline_ledger.json"

LEDGER_STATUSES: tuple[str, ...] = ("drafted", "reviewed", "submitted", "won", "lost")


def read_ledger(ledger_path: Path | str = DEFAULT_LEDGER) -> dict[str, dict[str, Any]]:
    path = Path(ledger_path)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_ledger(data: dict[str, dict[str, Any]], ledger_path: Path | str = DEFAULT_LEDGER) -> None:
    path = Path(ledger_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def status_of(notice_id: str, ledger_path: Path | str = DEFAULT_LEDGER) -> str | None:
    return read_ledger(ledger_path).get(notice_id, {}).get("status")


def update_status(
    notice_id: str,
    status: str,
    *,
    ledger_path: Path | str = DEFAULT_LEDGER,
    **metadata: Any,
) -> dict[str, Any]:
    if status not in LEDGER_STATUSES:
        raise ValueError(f"status must be one of {LEDGER_STATUSES}, got {status!r}")

    data = read_ledger(ledger_path)
    entry = data.get(notice_id, {})
    entry.update(metadata)
    entry["status"] = status
    history = entry.get("history", [])
    history.append({"status": status, "at": datetime.now(timezone.utc).isoformat()})
    entry["history"] = history
    data[notice_id] = entry
    write_ledger(data, ledger_path)
    return entry
