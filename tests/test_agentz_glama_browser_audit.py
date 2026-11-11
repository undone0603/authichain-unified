"""Hermetic tests for the no-payment AgentZ browser workflow."""
from __future__ import annotations
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

from agentz.workflows.handlers import glama_browser_audit as audit


def test_url_allowlist_blocks_paid_and_external_requests():
    assert audit.is_allowed_browser_request("https://glama.ai/mcp/inspector", "GET")
    assert audit.is_allowed_browser_request("https://assets.glama.ai/foo.js", "GET")
    assert not audit.is_allowed_browser_request("https://glama.ai/api/checkout", "POST")
    assert not audit.is_allowed_browser_request("https://authichain.com/mcp", "POST")
    assert not audit.is_allowed_browser_request("https://glama.ai.evil.com", "GET")
    assert not audit.is_allowed_browser_request("http://glama.ai/", "GET")
    assert not audit.is_allowed_browser_request("https://glama.ai@evil.com", "GET")


def test_guard_browser_route():
    class Route:
        def __init__(self, url, method):
            self.request = SimpleNamespace(url=url, method=method)
            self.continued = False
            self.aborted = False
        def continue_(self): self.continued = True
        def abort(self): self.aborted = True
    safe = Route("https://glama.ai/mcp/inspector", "GET")
    audit.guard_browser_route(safe)
    assert safe.continued and not safe.aborted
    unsafe = Route("https://glama.ai/api/checkout", "POST")
    audit.guard_browser_route(unsafe)
    assert unsafe.aborted and not unsafe.continued


def test_dry_run_never_launches_browser():
    ctx = SimpleNamespace(mode=SimpleNamespace(value="dry-run"))
    with patch.object(audit, "collect_evidence", side_effect=AssertionError("must not execute")):
        result = audit.run(ctx)
    assert result["status"] == "skipped"


def test_auto_mode_is_blocked():
    ctx = SimpleNamespace(mode=SimpleNamespace(value="auto"))
    with patch.object(audit, "collect_evidence", side_effect=AssertionError("must not execute")):
        result = audit.run(ctx)
    assert result["status"] == "blocked"


def test_unapproved_confirm_skips():
    ctx = SimpleNamespace(mode=SimpleNamespace(value="confirm"), step=lambda *a, **k: None)
    with patch.object(audit, "collect_evidence", side_effect=AssertionError("must not execute")):
        result = audit.run(ctx)
    assert result["status"] == "skipped"


def test_free_smoke_rejects_wrong_endpoint_and_paid_calls():
    payload = {"ok": True, "endpoint": audit.MCP_URL, "toolCount": 8,
               "paidCalls": 0, "settlementAttempts": 0, "serverVersion": "1.4.0",
               "protocolVersion": "2025-06-18"}
    class Completed:
        returncode = 0
        stdout = "PASS GET\n" + json.dumps(payload)
    with patch.object(audit.SMOKE_SCRIPT.__class__, "is_file", return_value=True), \
         patch.object(audit.shutil, "which", return_value="/usr/bin/node"), \
         patch.object(audit.subprocess, "run", return_value=Completed()) as run:
        result = audit.run_free_mcp_smoke()
        assert result["ok"]
        assert run.call_args.kwargs["env"] == {"PATH": "/usr/bin", "REQUIRE_MCP_HINTS": "0"}
        payload["paidCalls"] = 1
        Completed.stdout = "PASS GET\n" + json.dumps(payload)
        bad = audit.run_free_mcp_smoke()
        assert bad["ok"] is False


def test_evidence_preserves_failed_state(tmp_path):
    with patch.object(audit, "inspect_public_glama", return_value={"browser_passed": True}), \
         patch.object(audit, "run_free_mcp_smoke", return_value={"ok": False, "reason": "mcp_smoke_failed"}):
        result = audit.collect_evidence(evidence_dir=tmp_path)
    assert result["ok"] is False
    assert result["paid_actions"] == 0
    assert Path(result["evidence_path"]).exists()
    assert json.loads(Path(result["evidence_path"]).read_text())["ok"] is False
