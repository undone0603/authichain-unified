"""OpenClaw bridge client — dry-run + config (no live network required)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from agentz.integrations.openclaw import OpenClawClient, OpenClawConfig, status_summary

REPO = Path(__file__).resolve().parents[2]


def test_config_defaults(monkeypatch):
    for key in (
        "CLAW_BRIDGE_URL",
        "OPENCLAW_BRIDGE_URL",
        "OPENCLAW_API_KEY",
        "CLAW_BRIDGE_API_KEY",
    ):
        monkeypatch.delenv(key, raising=False)
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


def test_status_summary_shape(monkeypatch):
    monkeypatch.setenv("CLAW_BRIDGE_URL", "http://127.0.0.1:9")
    summary = status_summary()
    assert "bridge_url" in summary
    assert "api_key_set" in summary
    assert summary["health_ok"] is False


def test_cli_openclaw_notify_dry_run(monkeypatch):
    env = os.environ.copy()
    env["CLAW_BRIDGE_URL"] = "https://claw.example.test"
    env["OPENCLAW_API_KEY"] = "k"
    env["PYTHONPATH"] = str(REPO)
    code = (
        "from agentz.integrations.openclaw import OpenClawClient; "
        "import json; "
        "r = OpenClawClient().notify(\"ping from test\", dry_run=True); "
        "print(json.dumps({\"ok\": r.ok, \"dry_run\": r.dry_run}))"
    )
    out = subprocess.check_output([sys.executable, "-c", code], env=env, cwd=REPO, text=True)
    data = json.loads(out.strip())
    assert data["ok"] is True
    assert data["dry_run"] is True
