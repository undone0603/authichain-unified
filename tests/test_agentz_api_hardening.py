"""CORS, governor dry-run default, SSE auth, and scoped bearer tokens."""
from __future__ import annotations

import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from agentz.api.auth import (
    SSE_COOKIE_NAME,
    Scope,
    issue_sse_ticket,
    sse_ticket_valid,
    token_matches_any,
    verify_scope,
    verify_sse_auth,
)
from agentz.api.cors import DEFAULT_CORS_ORIGINS, cors_allow_origins
from agentz.api.mode_contract import resolve_execution_mode
from agentz.core import credentials as creds
from agentz.core.modes import Mode

import agentz.api.main as api

SECRET = "test-operator-secret"
READ = "test-read-token"
RUN = "test-run-token"
CREDS = "test-credentials-token"


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(creds, "_loaded", True)
    for name in (
        "AGENT_SECRET",
        "AGENT_SECRET_READ",
        "AGENT_SECRET_RUN",
        "AGENT_SECRET_CREDENTIALS",
        "AGENTZ_CORS_ORIGINS",
    ):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def client():
    return TestClient(api.app)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_cors_defaults_are_apex_hosts():
    origins = cors_allow_origins("")
    assert origins == list(DEFAULT_CORS_ORIGINS)
    assert "*" not in origins
    assert DEFAULT_CORS_ORIGINS[0] in origins
    assert DEFAULT_CORS_ORIGINS[2] in origins


def test_cors_rejects_wildcard_override():
    with pytest.raises(ValueError, match="wildcard"):
        cors_allow_origins("*")
    with pytest.raises(ValueError, match="wildcard"):
        cors_allow_origins(DEFAULT_CORS_ORIGINS[0] + ", *")


def test_cors_preflight_rejects_unknown_origin(client):
    response = client.options(
        "/health",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    allow = response.headers.get("access-control-allow-origin")
    assert allow != "*"
    assert allow is None


def test_cors_preflight_allows_apex_origin(client):
    origin = DEFAULT_CORS_ORIGINS[0]
    response = client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    assert response.headers.get("access-control-allow-origin") == origin
    assert "*" not in (response.headers.get("access-control-allow-origin") or "")


def test_governor_mode_contract_is_fail_closed():
    mode, coerced, live = resolve_execution_mode(
        query_mode="auto",
        workflow_id="governor_cycle",
        endpoint="governor",
    )
    assert mode == "dry-run"
    assert coerced is True
    assert live is False
    mode, coerced, live = resolve_execution_mode(
        query_mode="auto",
        live_query=True,
        workflow_id="governor_cycle",
        endpoint="governor",
    )
    assert mode == "auto"
    assert coerced is False
    assert live is True


def test_governor_cycle_defaults_to_dry_run(monkeypatch, client):
    monkeypatch.setenv("AGENT_SECRET", SECRET)
    captured: dict = {}

    class FakeGovernor:
        def __init__(self, mode=None, daily_budget=None):
            captured["mode"] = mode
            captured["budget"] = daily_budget

        def run_cycle(self, verbose=False):
            return SimpleNamespace(to_dict=lambda: {"ok": True})

    monkeypatch.setattr("agentz.core.governor.LaunchGovernor", FakeGovernor)
    response = client.post(
        "/launch/governor/cycle?mode=auto",
        headers=_auth(SECRET),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "dry-run"
    assert body["coerced_to_dry_run"] is True
    assert captured["mode"] == Mode.DRY_RUN


def test_governor_cycle_live_honors_auto(monkeypatch, client):
    monkeypatch.setenv("AGENT_SECRET", SECRET)
    captured: dict = {}

    class FakeGovernor:
        def __init__(self, mode=None, daily_budget=None):
            captured["mode"] = mode

        def run_cycle(self, verbose=False):
            return SimpleNamespace(to_dict=lambda: {"ok": True})

    monkeypatch.setattr("agentz.core.governor.LaunchGovernor", FakeGovernor)
    response = client.post(
        "/launch/governor/cycle?mode=auto&live=true",
        headers=_auth(SECRET),
    )
    assert response.status_code == 200
    assert response.json()["mode"] == "auto"
    assert response.json()["coerced_to_dry_run"] is False
    assert captured["mode"] == Mode.AUTO


def test_sse_query_token_is_rejected_even_when_it_matches(monkeypatch):
    monkeypatch.setenv("AGENT_SECRET", SECRET)
    with pytest.raises(HTTPException) as raised:
        verify_sse_auth(authorization=None, cookie=None, query_token=SECRET)
    assert raised.value.status_code == 401


def test_sse_bearer_and_cookie_ticket_use_compare_digest(monkeypatch, client):
    monkeypatch.setenv("AGENT_SECRET", SECRET)
    verify_sse_auth(authorization=f"Bearer {SECRET}", cookie=None, query_token=None)
    with pytest.raises(HTTPException) as raised:
        verify_sse_auth(authorization="Bearer x", cookie=None)
    assert raised.value.status_code == 401

    session = client.post("/launch/sse/session", headers=_auth(SECRET))
    assert session.status_code == 204
    cookie_header = session.headers.get("set-cookie", "")
    assert "HttpOnly" in cookie_header or "httponly" in cookie_header.lower()
    assert SECRET not in cookie_header
    ticket = session.cookies.get(SSE_COOKIE_NAME)
    assert ticket
    verify_sse_auth(authorization=None, cookie=ticket)

    # Wrong-length cookies/tokens must 401, not raise from compare_digest.
    assert token_matches_any("short", [SECRET]) is False
    assert sse_ticket_valid("not-a-ticket", [SECRET]) is False
    assert sse_ticket_valid(issue_sse_ticket(SECRET, now=0), [SECRET], now=10_000) is False


def test_sse_route_rejects_query_token(monkeypatch, client):
    monkeypatch.setenv("AGENT_SECRET", SECRET)
    response = client.get(f"/launch/sse/cycle?token={SECRET}")
    assert response.status_code == 401


def test_nothing_configured_fails_closed(client):
    response = client.get("/workflows")
    assert response.status_code == 503
    response = client.post("/launch/governor/cycle")
    assert response.status_code == 503


def test_legacy_agent_secret_satisfies_every_scope(monkeypatch, client):
    monkeypatch.setenv("AGENT_SECRET", SECRET)
    captured: dict = {}

    class FakeGovernor:
        def __init__(self, mode=None, daily_budget=None):
            captured["mode"] = mode

        def run_cycle(self, verbose=False):
            return SimpleNamespace(to_dict=lambda: {"ok": True})

    monkeypatch.setattr("agentz.core.governor.LaunchGovernor", FakeGovernor)
    assert client.get("/workflows", headers=_auth(SECRET)).status_code == 200
    assert client.post("/launch/governor/cycle", headers=_auth(SECRET)).status_code == 200
    status = client.get("/credentials/linkedin_session/status", headers=_auth(SECRET))
    assert status.status_code == 200


def test_scoped_tokens_enforce_read_run_credentials(monkeypatch, client):
    monkeypatch.setenv("AGENT_SECRET_READ", READ)
    monkeypatch.setenv("AGENT_SECRET_RUN", RUN)
    monkeypatch.setenv("AGENT_SECRET_CREDENTIALS", CREDS)

    class FakeGovernor:
        def __init__(self, mode=None, daily_budget=None):
            pass

        def run_cycle(self, verbose=False):
            return SimpleNamespace(to_dict=lambda: {"ok": True})

    monkeypatch.setattr("agentz.core.governor.LaunchGovernor", FakeGovernor)

    assert client.get("/workflows", headers=_auth(READ)).status_code == 200
    assert client.get("/workflows", headers=_auth(RUN)).status_code == 401
    assert client.post("/launch/governor/cycle", headers=_auth(RUN)).status_code == 200
    assert client.post("/launch/governor/cycle", headers=_auth(READ)).status_code == 401
    assert client.get("/credentials/linkedin_session/status", headers=_auth(CREDS)).status_code == 200
    assert client.get("/credentials/linkedin_session/status", headers=_auth(READ)).status_code == 401
    assert client.get("/workflows", headers=_auth(CREDS)).status_code == 401


def test_read_only_host_fails_closed_for_run(monkeypatch, client):
    monkeypatch.setenv("AGENT_SECRET_READ", READ)
    assert client.get("/workflows", headers=_auth(READ)).status_code == 200
    assert client.post("/launch/governor/cycle", headers=_auth(READ)).status_code == 503


def test_verify_scope_constant_time_on_length_mismatch(monkeypatch):
    monkeypatch.setenv("AGENT_SECRET", SECRET)
    with pytest.raises(HTTPException) as raised:
        verify_scope(Scope.RUN, "Bearer x")
    assert raised.value.status_code == 401
    with pytest.raises(HTTPException) as raised:
        verify_scope(Scope.RUN, "not-bearer")
    assert raised.value.status_code == 401
