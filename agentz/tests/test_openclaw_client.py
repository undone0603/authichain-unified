"""OpenClaw bridge client — dry-run + config (no live network required)."""
from __future__ import annotations

import json

import pytest

from agentz.integrations.openclaw import OpenClawClient, OpenClawConfig, status_summary
from agentz.cli import main


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for key in (
        "CLAW_BRIDGE_URL",
        "OPENCLAW_BRIDGE_URL",
        "OPENCLAW_API_KEY",
        "CLAW_BRIDGE_API_KEY",
    ):
        monkeypatch.delenv(key, raising=False)


def test_config_defaults():
    cfg = OpenClawConfig.from_env()
    assert cfg.bridge_url == "https://claw.authichain.com"
    assert cfg.api_key == ""


def test_config_aliases(monkeypatch):
    monkeypatch.setenv("OPENCLAW_BRIDGE_URL", "https://claw.example.test")
    monkeypatch.setenv("CLAW_BRIDGE_API_KEY", "secret-key")
    cfg = OpenClawConfig.from_env()
    assert cfg.bridge_url == "https://claw.example.test"
    assert cfg.api_key == "secret-key"


def test_notify_dry_run_does_not_need_network(monkeypatch):
    monkeypatch.setenv("CLAW_BRIDGE_URL", "https://claw.example.test")
    monkeypatch.setenv("OPENCLAW_API_KEY", "k")
    client = OpenClawClient()
    result = client.notify("hello", dry_run=True)
    assert result.ok and result.dry_run
    assert result.data["would_request"]["url"].endswith("/notify")
    assert result.data["would_request"]["body"]["text"] == "hello"


def test_command_dry_run(monkeypatch):
    monkeypatch.setenv("CLAW_BRIDGE_URL", "https://claw.example.test")
    client = OpenClawClient()
    result = client.command("agents", dry_run=True)
    assert result.ok and result.dry_run
    assert result.data["would_request"]["body"]["command"] == "agents"


def test_cli_openclaw_notify_dry_run(monkeypatch, capsys):
    monkeypatch.setenv("CLAW_BRIDGE_URL", "https://claw.example.test")
    monkeypatch.setenv("OPENCLAW_API_KEY", "k")
    code = main(["openclaw", "notify", "ping from test", "--dry-run"])
    assert code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["ok"] is True
    assert out["dry_run"] is True


def test_status_summary_shape(monkeypatch):
    monkeypatch.setenv("CLAW_BRIDGE_URL", "https://claw.example.test")
    # Force health to fail closed without network flake: empty unreachable host
    monkeypatch.setenv("CLAW_BRIDGE_URL", "http://127.0.0.1:9")
    summary = status_summary()
    assert "bridge_url" in summary
    assert "api_key_set" in summary
    assert summary["health_ok"] is False
