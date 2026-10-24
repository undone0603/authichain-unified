"""Allowlist, deny-list, path sanitization, and fail-closed tests.

These tests use temporary directories only. They do not run the harvester
against Downloads, Desktop, Documents, or any other real home path.
"""
from __future__ import annotations

from pathlib import Path

from grokbot import (
    SCAN_ALLOWLIST,
    discover,
    is_denied_path,
    main,
    redact,
    resolve_scan_roots,
    sanitize_path,
)


def test_allowlist_is_empty_by_default() -> None:
    assert SCAN_ALLOWLIST == ()
    assert resolve_scan_roots([]) == []
    assert resolve_scan_roots(None) == []


def test_empty_allowlist_discovers_nothing(tmp_path: Path) -> None:
    (tmp_path / "note.md").write_text("qron.space truemark\n", encoding="utf-8")
    assert discover([]) == []
    assert discover(resolve_scan_roots([])) == []


def test_never_defaults_to_home_folders() -> None:
    roots = resolve_scan_roots([])
    names = {Path(root).name.lower() for root in roots}
    assert names.isdisjoint({"downloads", "desktop", "documents"})
    home = Path.home()
    for folder in ("Downloads", "Desktop", "Documents"):
        assert home / folder not in roots


def test_explicit_tmp_root_is_scanned(tmp_path: Path) -> None:
    (tmp_path / "note.md").write_text("qron.space truemark\n", encoding="utf-8")
    records = discover(resolve_scan_roots([str(tmp_path)]))
    assert len(records) == 1
    assert "qron.space" in records[0].preview


def test_denied_env_file_is_dropped(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("qron.space\nAPI_KEY=fake\n", encoding="utf-8")
    (tmp_path / "ok.md").write_text("qron.space truemark\n", encoding="utf-8")
    records = discover([tmp_path])
    paths = [record.path for record in records]
    assert len(records) == 1
    assert any(path.endswith("ok.md") for path in paths)
    assert not any(".env" in path for path in paths)


def test_denied_key_and_cookie_names() -> None:
    assert is_denied_path(Path("/tmp/.env.local"))
    assert is_denied_path(Path("/tmp/id_rsa"))
    assert is_denied_path(Path("/tmp/id_rsa.pub"))
    assert is_denied_path(Path("/tmp/server.pem"))
    assert is_denied_path(Path("/tmp/tls.key"))
    assert is_denied_path(Path("/tmp/.netrc"))
    assert is_denied_path(Path("/tmp/.git-credentials"))
    assert is_denied_path(Path("/tmp/cookies.txt"))
    assert is_denied_path(Path.home() / ".mozilla" / "firefox" / "logins.json")


def test_sanitize_path_replaces_home_username() -> None:
    user = Path.home().name
    raw = Path.home() / "notes" / "local-preview.md"
    cleaned = sanitize_path(raw)
    assert user not in cleaned
    assert cleaned.startswith("~")


def test_binary_file_is_dropped(tmp_path: Path) -> None:
    (tmp_path / "notes.md").write_bytes(b"qron.space truemark\x00\xffbinary")
    assert discover([tmp_path]) == []


def test_undecodable_file_is_dropped(tmp_path: Path) -> None:
    (tmp_path / "notes.md").write_bytes(b"qron.space " + bytes(range(128, 256)))
    assert discover([tmp_path]) == []


def test_ambiguous_encoded_secret_fails_closed() -> None:
    secret = "sk_live_" + "FakeLocalOnly51AbCdEfGhIj"
    # Partial URL-encoding cannot be mapped back to a single original span.
    sample = "s%6b_live_" + secret[len("sk_live_") :]
    result = redact(sample)
    assert result.drop
    assert secret not in ("" if result.drop else result.text)


def test_main_without_root_scans_nothing(monkeypatch, capsys) -> None:
    seen: dict[str, list] = {}

    def fake_discover(roots):
        seen["roots"] = list(roots)
        return []

    monkeypatch.setattr("grokbot.discover", fake_discover)
    monkeypatch.setattr("sys.argv", ["grokbot", "--json"])
    assert main() == 0
    assert seen["roots"] == []
    assert "Downloads" not in capsys.readouterr().out
