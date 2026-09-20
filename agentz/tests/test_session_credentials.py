"""POST /credentials/{key} allowlist — never echo secret values."""
from __future__ import annotations

import json

import pytest

from agentz.api.session_credentials import (
    ALLOWED_SESSION_KEYS,
    apply_session_credential,
)
from agentz.core import credentials as creds


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch, tmp_path):
    monkeypatch.setattr(creds, "_loaded", True)
    monkeypatch.setattr(creds, "_env_path", tmp_path / "unused.env")
    for env_name in (
        "LINKEDIN_SESSION_COOKIE",
        "LINKEDIN_JSESSIONID",
        "REDDIT_SESSION_COOKIE",
        "TWITTER_SESSION_COOKIE",
    ):
        monkeypatch.delenv(env_name, raising=False)


def test_allowed_keys_are_session_cookies_only():
    assert ALLOWED_SESSION_KEYS == frozenset(
        {
            "linkedin_session",
            "linkedin_jsessionid",
            "reddit_session",
            "twitter_session",
        }
    )


def test_apply_maps_linkedin_session_and_never_echoes_value(monkeypatch):
    secret = "li_at_super_secret_cookie_value"
    result = apply_session_credential("linkedin_session", secret)
    assert result == {"ok": True, "key": "linkedin_session"}
    assert secret not in json.dumps(result)
    assert creds.get("linkedin_session") == secret


def test_apply_maps_linkedin_jsessionid(monkeypatch):
    secret = '"ajax:12345"'
    result = apply_session_credential("linkedin_jsessionid", secret)
    assert result == {"ok": True, "key": "linkedin_jsessionid"}
    assert secret not in json.dumps(result)
    assert creds.get("linkedin_jsessionid") == secret


def test_apply_rejects_unknown_key():
    with pytest.raises(ValueError, match="not allowed"):
        apply_session_credential("stripe_secret", "sk_live_nope")
    assert creds.get("stripe_secret", required=False) is None


def test_apply_rejects_empty_value():
    with pytest.raises(ValueError, match="empty"):
        apply_session_credential("linkedin_session", "   ")
