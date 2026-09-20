"""content-publish LinkedIn: session cookie is not a silent OAuth skip."""
from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "publish-social-bundle.py"


def _load():
    spec = importlib.util.spec_from_file_location("publish_social_bundle", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_linkedin_oauth_missing_with_session_cookie_points_at_agentz(monkeypatch):
    mod = _load()
    monkeypatch.delenv("LINKEDIN_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("LINKEDIN_PERSON_URN", raising=False)
    monkeypatch.setenv("LINKEDIN_SESSION_COOKIE", "li_at_present")
    ok, msg = mod.post_linkedin({"linkedin": "hello"}, dry=False)
    assert ok is False
    assert "session cookie present" in msg.lower()
    assert "agentz" in msg.lower()


def test_linkedin_oauth_missing_without_session_keeps_oauth_skip(monkeypatch):
    mod = _load()
    monkeypatch.delenv("LINKEDIN_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("LINKEDIN_PERSON_URN", raising=False)
    monkeypatch.delenv("LINKEDIN_SESSION_COOKIE", raising=False)
    ok, msg = mod.post_linkedin({"linkedin": "hello"}, dry=False)
    assert ok is False
    assert "LINKEDIN_ACCESS_TOKEN" in msg
