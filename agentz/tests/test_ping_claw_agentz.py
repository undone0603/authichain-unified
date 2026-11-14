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
    assert "CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}" in yml
    assert "CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}" in yml
    assert "Missing CF_ACCESS_CLIENT_ID or CF_ACCESS_CLIENT_SECRET" in yml
    assert "Do not add an Access bypass" in yml


def test_scheduled_dry_run_is_fail_closed():
    """Schedule never inherits inputs.dry_run || 'false' (that was live).

    It goes live only behind the launch-mode resolver, which reports inactive
    when launch mode is disabled, expired or malformed; otherwise dry-run.
    """
    yml = (REPO / ".github" / "workflows" / "agentz-orchestration.yml").read_text()
    assert "${{ inputs.dry_run || 'false' }}" not in yml
    assert "${{ inputs.dry_run || 'true' }}" not in yml
    assert "run: node scripts/autonomy/launch-mode.mjs" in yml
    assert 'if [ "${{ github.event_name }}" = "schedule" ]; then' in yml
    schedule_block = yml.split('if [ "${{ github.event_name }}" = "schedule" ]; then', 1)[1]
    schedule_block = schedule_block.split("fi", 1)[0]
    guard = 'if [ "${{ steps.launch.outputs.active }}" = "true" ]; then'
    before, guarded = schedule_block.split(guard, 1)
    live, fallback = guarded.split("else", 1)
    assert 'echo "dry_run=false"' not in before
    assert 'echo "dry_run=false" >> "$GITHUB_OUTPUT"' in live
    assert 'echo "dry_run=true" >> "$GITHUB_OUTPUT"' in fallback
    assert 'echo "dry_run=false"' not in fallback
    assert "OWNER_LIVE_SEND" not in schedule_block
    assert "DRY_RUN: ${{ needs.resolve-mode.outputs.dry_run }}" in yml


def test_orchestration_workflow_does_not_use_env_context_for_urls():
    """Job-level env cannot use ${{ env.* }}; that fails workflow parse."""
    yml = (REPO / ".github" / "workflows" / "agentz-orchestration.yml").read_text()
    assert "${{ env.CLAW_URL }}" not in yml
    assert "${{ env.AGENTZ_API_URL }}" not in yml
    # Public hosts stay literals (or step-level env / run), never env context.
    assert yml.count("CLAW_URL: https://claw.authichain.com") >= 1
    assert yml.count("AGENTZ_API_URL: https://agentz.authichain.com") >= 1


def _clear_access_env(monkeypatch):
    for name in (
        "CF_ACCESS_CLIENT_ID",
        "CF_ACCESS_CLIENT_SECRET",
        "CLOUDFLARE_ACCESS_CLIENT_ID",
        "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    ):
        monkeypatch.delenv(name, raising=False)


def test_require_access_headers_fails_when_missing(monkeypatch):
    _clear_access_env(monkeypatch)
    with pytest.raises(SystemExit, match="missing Cloudflare Access service-token secrets"):
        ping.require_access_headers()
    monkeypatch.setenv("CF_ACCESS_CLIENT_ID", "id-only")
    with pytest.raises(SystemExit, match="missing Cloudflare Access service-token secrets"):
        ping.require_access_headers()
    monkeypatch.setenv("CF_ACCESS_CLIENT_SECRET", "secret")
    assert ping.require_access_headers()["CF-Access-Client-Id"] == "id-only"


def test_request_json_fails_closed_without_access_secrets(monkeypatch):
    _clear_access_env(monkeypatch)

    def no_network(*args, **kwargs):
        raise AssertionError("must not call the network when Access secrets are missing")

    monkeypatch.setattr(ping, "_OPENER", type("O", (), {"open": staticmethod(no_network)})())
    with pytest.raises(SystemExit, match="missing Cloudflare Access service-token secrets"):
        ping.request_json("GET", "https://agentz.authichain.com/health")


class _FakeResp:
    def __init__(self, status, body, headers=None):
        self.status = status
        self._body = body.encode("utf-8")
        self.headers = headers or {}

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_request_json_fails_on_html_not_json(monkeypatch):
    _clear_access_env(monkeypatch)
    monkeypatch.setenv("CF_ACCESS_CLIENT_ID", "id")
    monkeypatch.setenv("CF_ACCESS_CLIENT_SECRET", "secret")
    html = "<!DOCTYPE html>\n<html lang=\"en\">\n<title>AgentZ Sovereign Terminal</title>"

    def open_html(req, timeout=None):
        return _FakeResp(200, html)

    monkeypatch.setattr(ping, "_OPENER", type("O", (), {"open": staticmethod(open_html)})())
    with pytest.raises(SystemExit, match="body is HTML, not JSON"):
        ping.request_json("GET", "https://agentz.authichain.com/health")


def test_request_json_fails_on_access_login_redirect(monkeypatch):
    import urllib.error
    from email.message import EmailMessage

    _clear_access_env(monkeypatch)
    monkeypatch.setenv("CF_ACCESS_CLIENT_ID", "id")
    monkeypatch.setenv("CF_ACCESS_CLIENT_SECRET", "secret")

    def open_redirect(req, timeout=None):
        hdrs = EmailMessage()
        hdrs["Location"] = "https://example.cloudflareaccess.com/cdn-cgi/access/login"
        raise urllib.error.HTTPError(
            "https://agentz.authichain.com/health",
            302,
            "Found",
            hdrs,
            __import__("io").BytesIO(b""),
        )

    monkeypatch.setattr(ping, "_OPENER", type("O", (), {"open": staticmethod(open_redirect)})())
    with pytest.raises(SystemExit, match="behind Cloudflare Access"):
        ping.request_json("GET", "https://agentz.authichain.com/health")


def test_request_json_accepts_json_health(monkeypatch):
    _clear_access_env(monkeypatch)
    monkeypatch.setenv("CF_ACCESS_CLIENT_ID", "id")
    monkeypatch.setenv("CF_ACCESS_CLIENT_SECRET", "secret")
    sent = {}

    def open_json(req, timeout=None):
        sent["headers"] = dict(req.header_items())
        return _FakeResp(200, '{"status": "sovereign", "network": "Polygon"}')

    monkeypatch.setattr(ping, "_OPENER", type("O", (), {"open": staticmethod(open_json)})())
    status, body = ping.request_json("GET", "https://agentz.authichain.com/health")
    assert status == 200
    assert body["status"] == "sovereign"
    headers = {k.lower(): v for k, v in sent["headers"].items()}
    assert headers["cf-access-client-id"] == "id"
    assert headers["cf-access-client-secret"] == "secret"
