"""Unit tests for scripts/ops/ping_claw_agentz.py — no live network."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
_SPEC = importlib.util.spec_from_file_location(
    "ping_claw_agentz", REPO / "scripts" / "ops" / "ping_claw_agentz.py"
)
assert _SPEC and _SPEC.loader
ping = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(ping)


def test_default_urls_are_live_hosts():
    assert ping.DEFAULT_CLAW_URL == "https://claw.authichain.com"
    assert ping.DEFAULT_AGENTZ_URL == "https://agentz.authichain.com"


def test_env_urls(monkeypatch):
    monkeypatch.delenv("CLAW_URL", raising=False)
    monkeypatch.delenv("CLAW_BRIDGE_URL", raising=False)
    monkeypatch.delenv("OPENCLAW_BRIDGE_URL", raising=False)
    monkeypatch.delenv("AGENTZ_API_URL", raising=False)
    assert ping.claw_url() == ping.DEFAULT_CLAW_URL
    assert ping.agentz_url() == ping.DEFAULT_AGENTZ_URL
    monkeypatch.setenv("CLAW_BRIDGE_URL", "https://claw.example.test/")
    monkeypatch.setenv("AGENTZ_API_URL", "https://agentz.example.test/")
    assert ping.claw_url() == "https://claw.example.test"
    assert ping.agentz_url() == "https://agentz.example.test"


def test_rejects_local_and_trycloudflare():
    with pytest.raises(SystemExit):
        ping.require_https_public_host("http://127.0.0.1:8000", label="AGENTZ_API_URL")
    with pytest.raises(SystemExit):
        ping.require_https_public_host(
            "https://family-cookbook.trycloudflare.com", label="AGENTZ_API_URL"
        )
    ping.require_https_public_host("https://agentz.authichain.com", label="AGENTZ_API_URL")


def test_refuses_architect_auto(monkeypatch, capsys):
    monkeypatch.delenv("OPENCLAW_GATEWAY_URL", raising=False)
    code = ping.main(["--architect", "--mode", "auto"])
    assert code == 2
    err = capsys.readouterr().err
    assert "refusing architect mode='auto'" in err


def test_health_only_success(monkeypatch, capsys):
    calls: list[tuple[str, str]] = []

    def fake_request(method, url, **kwargs):
        calls.append((method, url))
        if url.endswith("claw.authichain.com/health"):
            return 200, {
                "status": "ok",
                "service": "authichain-openclaw",
                "agentz_api": "configured",
                "openclaw_gateway": "not_set",
            }
        if url.endswith("agentz.authichain.com/health"):
            return 200, {"status": "sovereign", "network": "Polygon"}
        raise AssertionError(f"unexpected url {url}")

    monkeypatch.setattr(ping, "request_json", fake_request)
    monkeypatch.delenv("OPENCLAW_GATEWAY_URL", raising=False)
    monkeypatch.delenv("CLAW_URL", raising=False)
    monkeypatch.delenv("AGENTZ_API_URL", raising=False)
    assert ping.main(["--health-only"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["claw_url"] == "https://claw.authichain.com"
    assert out["agentz_url"] == "https://agentz.authichain.com"
    assert out["openclaw_gateway_url_set_in_job"] is False
    assert [c[0] for c in calls] == ["GET", "GET"]
    assert not any("/architect/" in url for _, url in calls)


def test_architect_posts_dry_run_only(monkeypatch, capsys):
    def fake_request(method, url, **kwargs):
        if url.endswith("/health"):
            if "claw" in url:
                return 200, {
                    "status": "ok",
                    "service": "authichain-openclaw",
                    "agentz_api": "configured",
                }
            return 200, {"status": "sovereign"}
        assert method == "POST"
        assert url == "https://claw.authichain.com/architect/cycle"
        assert kwargs["body"]["mode"] == "dry-run"
        assert kwargs["auth"] is True
        return 200, {"report": {"cycle_id": "test"}}

    monkeypatch.setattr(ping, "request_json", fake_request)
    monkeypatch.delenv("OPENCLAW_GATEWAY_URL", raising=False)
    assert ping.main(["--architect", "--mode", "dry-run"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["architect"]["http"] == 200


def test_access_headers_only_when_both_set(monkeypatch):
    monkeypatch.delenv("CF_ACCESS_CLIENT_ID", raising=False)
    monkeypatch.delenv("CF_ACCESS_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("CLOUDFLARE_ACCESS_CLIENT_ID", raising=False)
    monkeypatch.delenv("CLOUDFLARE_ACCESS_CLIENT_SECRET", raising=False)
    assert ping.access_headers() == {}
    monkeypatch.setenv("CF_ACCESS_CLIENT_ID", "id-only")
    assert ping.access_headers() == {}
    monkeypatch.setenv("CF_ACCESS_CLIENT_SECRET", "secret")
    assert ping.access_headers() == {
        "CF-Access-Client-Id": "id-only",
        "CF-Access-Client-Secret": "secret",
    }


def test_script_does_not_invent_openclaw_gateway_url():
    src = (REPO / "scripts" / "ops" / "ping_claw_agentz.py").read_text()
    assert "OPENCLAW_GATEWAY_URL" in src
    assert "do not invent" in src.lower() or "Does not read or set OPENCLAW_GATEWAY_URL" in src
    assert "ws://localhost" not in src
    assert "18789" not in src


def test_orchestration_workflow_wires_live_hosts_and_dry_run():
    yml = (REPO / ".github" / "workflows" / "agentz-orchestration.yml").read_text()
    assert "CLAW_URL: https://claw.authichain.com" in yml
    assert "AGENTZ_API_URL: https://agentz.authichain.com" in yml
    assert "ping_claw_agentz.py --architect --mode dry-run" in yml
    assert "OPENCLAW_GATEWAY_URL" in yml
    assert "ws://localhost" not in yml
    assert "Does not thaw content-publish" in yml
    assert 'echo "dry_run=true" >> "$GITHUB_OUTPUT"' in yml
