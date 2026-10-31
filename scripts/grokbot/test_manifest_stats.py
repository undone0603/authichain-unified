"""Manifest stats: counts only, never secret values. Synthetic tree only."""
from __future__ import annotations

import json
from pathlib import Path

from grokbot import (
    REDACTION_CATEGORIES,
    build_manifest,
    harvest,
    main,
)


def _fake(prefix: str, body: str) -> str:
    return f"{prefix}{body}"


def _tree(tmp_path: Path) -> tuple[Path, dict[str, str]]:
    root = tmp_path / "root"
    root.mkdir()
    secrets = {
        "stripe": _fake("sk_live_", "FakeLocalOnly51AbCdEfGhIj"),
        "github": _fake("ghp_", "FakeLocalOnlyGithubTokAAAA"),
        "jwt": _fake("eyJ", "hbGciOiJIUzI1NiJ9") + "." + _fake("eyJ", "zdWIiOiJmYWtlIn0") + "." + ("c" * 16),
        "aws": _fake("AKIA", "FAKELOCALAWSKEY1"),
        "assign": "abcd",
        "bearer": "faketokenvalue000000000",
        "email": _fake("probe.user", "@example.com"),
        "phone": "555" + "-010" + "-0099",
        "block": "999 Example Court Unit 4",
    }
    (root / "keep.md").write_text(
        "\n".join(
            [
                "qron.space truemark",
                f"using {secrets['stripe']}",
                f"role {secrets['jwt']}",
                f"id {secrets['aws']}",
                f"API_KEY={secrets['assign']}",
                f"Bearer {secrets['bearer']}",
                f"contact {secrets['email']}",
                f"visit {secrets['block']}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (root / "extra.md").write_text(
        "\n".join(
            [
                "qron.space truemark",
                f"tok {secrets['github']}",
                f"call {secrets['phone']}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (root / "noise.txt").write_text("nothing relevant here\n", encoding="utf-8")
    (root / ".env").write_text("API_KEY=fake\n", encoding="utf-8")
    (root / "tls.pem").write_text("not-a-real-key\n", encoding="utf-8")
    (root / "binary.md").write_bytes(b"qron.space truemark\x00\xff")
    return root, secrets


def test_harvest_stats_on_synthetic_tree(tmp_path: Path, monkeypatch) -> None:
    root, secrets = _tree(tmp_path)
    block = tmp_path / "pii-blocklist"
    block.write_text(secrets["block"] + "\n", encoding="utf-8")
    monkeypatch.setenv("GROKBOT_PII_BLOCKLIST", str(block))

    records, stats = harvest([root])
    payload = stats.as_dict()
    assert payload["files_considered"] == 6
    assert payload["files_skipped_denylist"] == 2
    assert payload["files_dropped_failclosed"] == 1
    assert payload["files_scanned"] == 3
    assert payload["records_written"] == 2
    assert len(records) == 2

    cats = payload["redactions_by_category"]
    assert set(cats) == set(REDACTION_CATEGORIES)
    assert all(isinstance(cats[name], int) for name in REDACTION_CATEGORIES)
    assert cats["stripe"] == 1
    assert cats["github"] == 1
    assert cats["jwt"] == 1
    assert cats["aws"] == 1
    assert cats["generic_assignment"] == 1
    assert cats["auth_header"] == 1
    assert cats["email"] == 1
    assert cats["phone"] == 1
    assert cats["address_blocklist"] == 1
    assert cats["key_block"] == 0
    assert cats["wallet"] == 0
    assert cats["seed_phrase"] == 0
    assert cats["url_credential"] == 0
    assert cats["ssn"] == 0
    assert cats["card"] == 0
    assert cats["ip"] == 0

    manifest = build_manifest([root], records, stats)
    dumped = json.dumps(manifest)
    for secret in secrets.values():
        assert secret not in dumped
    assert "stats" in manifest
    assert manifest["stats"] == payload
    assert all(isinstance(manifest["stats"][key], int) for key in payload if key != "redactions_by_category")


def test_main_writes_counts_only_stats(tmp_path: Path, monkeypatch, capsys) -> None:
    root, secrets = _tree(tmp_path)
    block = tmp_path / "pii-blocklist"
    block.write_text(secrets["block"] + "\n", encoding="utf-8")
    monkeypatch.setenv("GROKBOT_PII_BLOCKLIST", str(block))
    out = tmp_path / "evidence"
    monkeypatch.setattr(
        "sys.argv",
        ["grokbot", "--root", str(root), "--write-dir", str(out)],
    )
    assert main() == 0
    captured = capsys.readouterr()
    line = captured.err.strip().splitlines()[-1]
    assert line.startswith("grokbot stats:")
    assert "considered=6" in line
    assert "scanned=3" in line
    assert "skipped_denylist=2" in line
    assert "dropped_failclosed=1" in line
    assert "written=2" in line
    assert "stripe=1" in line
    for secret in secrets.values():
        assert secret not in captured.err
        assert secret not in captured.out

    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    dumped = json.dumps(manifest)
    for secret in secrets.values():
        assert secret not in dumped
    assert manifest["stats"]["records_written"] == 2
