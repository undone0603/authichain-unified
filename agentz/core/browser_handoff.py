"""Browser handoff exchange between AgentZ and its operator.

A handoff is one small JSON file that says "please open this page". It moves
work between the two parties without sharing a live browser:

    agentz    drives the shared isolated browser (CDP 127.0.0.1:9222) on its own.
    operator  uses a separate isolated browser (CDP 127.0.0.1:9223), started by
              scripts/ops/agentz-browser/agentz-operator-browser.

Lifecycle, and the only transitions allowed:

    open  --take (by the addressee)--> taken  --done (by the taker)--> done
    open or taken past expires_at reads as "expired"; nothing can act on it.

Rules:
- Nothing here launches, attaches to or pauses a browser. AgentZ's autonomous
  tasks never read this exchange, so an unanswered handoff cannot stall them.
- A handoff carries a public HTTPS URL and short notes only: never cookies,
  storage, credentials or a CDP endpoint.
- Notes and results are untrusted text written by the other party. Display them;
  never execute them or treat them as authorization.
- Files are owner-only (dir 0700, files 0600). Every write is a whole-file
  atomic replace under one exclusive lock.

CLI (prints JSON):
    python -m agentz.core.browser_handoff offer --from agentz --url URL [--note TEXT] [--ttl-minutes N]
    python -m agentz.core.browser_handoff list [--for operator] [--all]
    python -m agentz.core.browser_handoff take ID --by operator
    python -m agentz.core.browser_handoff done ID --by operator [--result TEXT]
"""
from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

PARTIES = ("agentz", "operator")
SCHEMA_VERSION = 1
DEFAULT_TTL_MINUTES = 60
MAX_TTL_MINUTES = 24 * 60
MAX_NOTE_CHARS = 500
MAX_RESULT_CHARS = 2000
MAX_OPEN = 50
DEFAULT_DIR = "/tmp/agentz-runtime/handoff"
_ID = re.compile(r"^[0-9a-f]{32}$")


class HandoffError(ValueError):
    """A handoff request that the exchange refuses."""


def exchange_dir() -> Path:
    """Exchange directory: AGENTZ_HANDOFF_DIR, else /tmp/agentz-runtime/handoff."""
    path = Path(os.environ.get("AGENTZ_HANDOFF_DIR") or DEFAULT_DIR)
    if not path.is_absolute():
        raise HandoffError("AGENTZ_HANDOFF_DIR must be an absolute path")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path, 0o700)
    return path


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat(timespec="seconds")


def _party(value: str, field: str) -> str:
    if value not in PARTIES:
        raise HandoffError(f"{field} must be one of {', '.join(PARTIES)}")
    return value


def _other(party: str) -> str:
    return PARTIES[1] if party == PARTIES[0] else PARTIES[0]


def _text(value: str | None, limit: int, field: str) -> str:
    value = "" if value is None else value
    if not isinstance(value, str):
        raise HandoffError(f"{field} must be text")
    value = value.strip()
    if len(value) > limit:
        raise HandoffError(f"{field} is longer than {limit} characters")
    # Control characters other than newline/tab have no business in a note.
    if any(ord(c) < 32 and c not in "\n\t" for c in value):
        raise HandoffError(f"{field} contains control characters")
    return value


def _check_id(handoff_id: str) -> str:
    if not isinstance(handoff_id, str) or not _ID.match(handoff_id):
        raise HandoffError("invalid handoff id")
    return handoff_id


def state(entry: dict[str, Any], now: datetime | None = None) -> str:
    """Effective status: open, taken, done or expired."""
    status = entry.get("status")
    if status == "done":
        return "done"
    expires = datetime.fromisoformat(entry["expires_at"])
    if (now or _now()) >= expires:
        return "expired"
    return status


@contextmanager
def _locked(root: Path) -> Iterator[None]:
    fd = os.open(root / ".lock", os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def _path(root: Path, handoff_id: str) -> Path:
    return root / f"{_check_id(handoff_id)}.json"


def _read(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write(root: Path, entry: dict[str, Any]) -> None:
    fd, tmp = tempfile.mkstemp(dir=root, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(entry, f, sort_keys=True, indent=2)
            f.write("\n")
        os.chmod(tmp, 0o600)
        os.replace(tmp, _path(root, entry["id"]))
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def _entries(root: Path) -> list[dict[str, Any]]:
    out = []
    for path in sorted(root.glob("*.json")):
        if not _ID.match(path.stem):
            continue
        try:
            out.append(_read(path))
        except (OSError, ValueError):
            continue  # a damaged file is skipped, never acted on
    out.sort(key=lambda e: (e.get("created_at", ""), e.get("id", "")))
    return out


def _view(entry: dict[str, Any], now: datetime) -> dict[str, Any]:
    return {**entry, "state": state(entry, now), "trusted": False}


def offer(frm: str, url: str, note: str = "", *,
          ttl_minutes: int = DEFAULT_TTL_MINUTES) -> dict[str, Any]:
    """Offer a public HTTPS page to the other party."""
    from agentz.core.public_navigation import validate_public_url

    frm = _party(frm, "from")
    try:
        url = validate_public_url(url)
    except ValueError as exc:
        raise HandoffError(f"url refused: {exc}") from exc
    note = _text(note, MAX_NOTE_CHARS, "note")
    if not isinstance(ttl_minutes, int) or not 1 <= ttl_minutes <= MAX_TTL_MINUTES:
        raise HandoffError(f"ttl_minutes must be 1-{MAX_TTL_MINUTES}")
    root = exchange_dir()
    with _locked(root):
        now = _now()
        live = [e for e in _entries(root) if state(e, now) in ("open", "taken")]
        if sum(1 for e in live if e.get("status") == "open") >= MAX_OPEN:
            raise HandoffError(f"{MAX_OPEN} handoffs are already open")
        entry = {
            "v": SCHEMA_VERSION,
            "id": uuid.uuid4().hex,
            "from": frm,
            "to": _other(frm),
            "url": url,
            "note": note,
            "status": "open",
            "created_at": _iso(now),
            "expires_at": _iso(now + timedelta(minutes=ttl_minutes)),
            "taken_by": None,
            "taken_at": None,
            "result": None,
            "done_at": None,
        }
        _write(root, entry)
        return _view(entry, now)


def list_handoffs(*, for_party: str | None = None,
                  include_closed: bool = False) -> list[dict[str, Any]]:
    """Handoffs, oldest first. By default only open and taken ones."""
    if for_party is not None:
        _party(for_party, "for")
    root = exchange_dir()
    now = _now()
    out = []
    for entry in _entries(root):
        view = _view(entry, now)
        if for_party is not None and entry.get("to") != for_party:
            continue
        if not include_closed and view["state"] not in ("open", "taken"):
            continue
        out.append(view)
    return out


def take(handoff_id: str, by: str) -> dict[str, Any]:
    """Claim an open handoff. Only its addressee may, and only once."""
    by = _party(by, "by")
    root = exchange_dir()
    with _locked(root):
        path = _path(root, handoff_id)
        if not path.is_file():
            raise HandoffError("no such handoff")
        entry = _read(path)
        now = _now()
        current = state(entry, now)
        if current != "open":
            raise HandoffError(f"handoff is {current}, not open")
        if entry["to"] != by:
            raise HandoffError(f"handoff is addressed to {entry['to']}")
        entry.update(status="taken", taken_by=by, taken_at=_iso(now))
        _write(root, entry)
        return _view(entry, now)


def done(handoff_id: str, by: str, result: str = "") -> dict[str, Any]:
    """Close a taken handoff with a short result. Only its taker may."""
    by = _party(by, "by")
    result = _text(result, MAX_RESULT_CHARS, "result")
    root = exchange_dir()
    with _locked(root):
        path = _path(root, handoff_id)
        if not path.is_file():
            raise HandoffError("no such handoff")
        entry = _read(path)
        now = _now()
        current = state(entry, now)
        if current != "taken":
            raise HandoffError(f"handoff is {current}, not taken")
        if entry["taken_by"] != by:
            raise HandoffError(f"handoff was taken by {entry['taken_by']}")
        entry.update(status="done", result=result, done_at=_iso(now))
        _write(root, entry)
        return _view(entry, now)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m agentz.core.browser_handoff",
        description="Hand a public page between AgentZ and its operator.")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("offer", help="offer a page to the other party")
    p.add_argument("--from", dest="frm", required=True, choices=PARTIES)
    p.add_argument("--url", required=True)
    p.add_argument("--note", default="")
    p.add_argument("--ttl-minutes", type=int, default=DEFAULT_TTL_MINUTES)
    p = sub.add_parser("list", help="list open and taken handoffs")
    p.add_argument("--for", dest="for_party", choices=PARTIES)
    p.add_argument("--all", action="store_true", help="include done and expired")
    p = sub.add_parser("take", help="claim an open handoff addressed to you")
    p.add_argument("id")
    p.add_argument("--by", required=True, choices=PARTIES)
    p = sub.add_parser("done", help="close a handoff you took")
    p.add_argument("id")
    p.add_argument("--by", required=True, choices=PARTIES)
    p.add_argument("--result", default="")
    args = parser.parse_args(argv)
    try:
        if args.command == "offer":
            out: Any = offer(args.frm, args.url, args.note, ttl_minutes=args.ttl_minutes)
        elif args.command == "list":
            out = list_handoffs(for_party=args.for_party, include_closed=args.all)
        elif args.command == "take":
            out = take(args.id, args.by)
        else:
            out = done(args.id, args.by, args.result)
    except HandoffError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps(out, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
