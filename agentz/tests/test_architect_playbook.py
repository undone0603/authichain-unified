"""The planner's system prompt carries the operations playbook."""

from __future__ import annotations

from agentz.core.architect import PLAYBOOK_PATH, playbook_section


def test_playbook_exists_and_is_loaded():
    assert PLAYBOOK_PATH.is_file()
    section = playbook_section()
    assert "owner gates" in section
    assert "Merge one PR per green main" in section


def test_missing_playbook_adds_nothing(tmp_path):
    assert playbook_section(tmp_path / "absent.md") == ""


def test_playbook_is_size_capped(tmp_path):
    big = tmp_path / "big.md"
    big.write_text("x" * 50_000, encoding="utf-8")
    assert len(playbook_section(big)) < 13_000


def test_playbook_fits_the_cap_untruncated():
    from agentz.core.architect import PLAYBOOK_MAX_CHARS

    text = PLAYBOOK_PATH.read_text(encoding="utf-8").strip()
    assert len(text) <= PLAYBOOK_MAX_CHARS, "playbook would be truncated in the planner prompt; trim it"
