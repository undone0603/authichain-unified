# agentz/core/grants_pipeline.py
"""
agentz.core.grants_pipeline
---------------------------
CSV loader and pipeline ledger for federal grant opportunities (Phase 6).
Now enhanced with Supabase centralized storage (Phase 14).
"""
from __future__ import annotations
import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from agentz.core.credentials import get
from supabase import create_client, Client

logger = logging.getLogger("agentz.grants_pipeline")

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = REPO_ROOT / "gov_pursue_list.csv"

LOGS_DIR = Path(__file__).resolve().parents[1] / "logs" / "grants"
DEFAULT_LEDGER = LOGS_DIR / "pipeline_ledger.json"

LEDGER_STATUSES: tuple[str, ...] = ("drafted", "reviewed", "submitted", "won", "lost")

def _get_supabase() -> Client | None:
    """Helper to initialize Supabase client if keys exist."""
    try:
        url = get("supabase_url", required=False)
        key = get("supabase_service_key", required=False)
        if url and key:
            return create_client(url, key)
    except:
        pass
    return None

def load_pursue_list(csv_path: Path | str | None = None) -> list[dict[str, Any]]:
    """Return all rows from the pursue list with fit_score coerced to int."""
    path = Path(csv_path or DEFAULT_CSV)
    if not path.exists():
        return []
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


def _parse_deadline(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def qualified_opportunities(
    csv_path: Path | str | None = None,
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


def read_ledger(ledger_path: Path | str | None = None) -> dict[str, dict[str, Any]]:
    path = Path(ledger_path or DEFAULT_LEDGER)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, PermissionError):
        return {}


def write_ledger(data: dict[str, dict[str, Any]], ledger_path: Path | str | None = None) -> None:
    path = Path(ledger_path or DEFAULT_LEDGER)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def status_of(notice_id: str, ledger_path: Path | str | None = None) -> str | None:
    """Returns the status of an opportunity, checking Supabase first then JSON fallback."""
    # 1. Try Supabase First
    supabase = _get_supabase()
    if supabase:
        try:
            res = supabase.table("federal_pipeline").select("status").eq("notice_id", notice_id).execute()
            if res.data:
                return res.data[0]["status"]
        except Exception as e:
            logger.warning(f"Supabase status_of failed, falling back to JSON: {e}")

    # 2. Fallback to JSON
    return read_ledger(ledger_path or DEFAULT_LEDGER).get(notice_id, {}).get("status")


def update_status(
    notice_id: str,
    status: str,
    *,
    ledger_path: Path | str | None = None,
    **metadata: Any,
) -> dict[str, Any]:
    """Updates the status and history of an opportunity in both Supabase and JSON fallback."""
    if status not in LEDGER_STATUSES:
        raise ValueError(f"status must be one of {LEDGER_STATUSES}, got {status!r}")

    # 1. Update JSON Fallback (Always, to keep local in sync)
    data = read_ledger(ledger_path or DEFAULT_LEDGER)
    entry = data.get(notice_id, {})
    entry.update(metadata)
    entry["status"] = status
    history = entry.get("history", [])
    history.append({"status": status, "at": datetime.now(timezone.utc).isoformat()})
    entry["history"] = history
    data[notice_id] = entry
    write_ledger(data, ledger_path or DEFAULT_LEDGER)

    # 2. Update Supabase
    supabase = _get_supabase()
    if supabase:
        try:
            # Sync metadata fields
            payload = {
                "notice_id": notice_id,
                "status": status,
                "history": history,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            # Add specific fields if present in metadata
            for field in ["title", "agency", "deadline", "fit_score", "artifact_path"]:
                if field in entry:
                    payload[field] = entry[field]
            
            supabase.table("federal_pipeline").upsert(payload).execute()
        except Exception as e:
            logger.warning(f"Supabase update_status failed: {e}")

    return entry
