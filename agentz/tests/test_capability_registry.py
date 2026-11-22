"""Contract tests for the AgentZ capability registry and hosted MCP adapter.

No network, no credentials: the transport is a fake that records payloads.
"""
import json

import pytest
import yaml

from agentz.integrations import authichain_mcp as m

READ_ONLY = {"readOnlyHint": True, "destructiveHint": False}


def live_tools():
    return [
        {"name": "get_pricing", "annotations": READ_ONLY,
         "inputSchema": {"type": "object", "properties": {}}},
        {"name": "dpp_readiness_check", "annotations": READ_ONLY,
         "inputSchema": {"type": "object", "required": ["category"],
                         "properties": {"category": {"type": "string"}}}},
        {"name": "query_provenance", "annotations": READ_ONLY,
         "inputSchema": {"type": "object", "required": ["assetId"],
                         "properties": {"assetId": {"type": "string"}}}},
        {"name": "verify", "annotations": {"readOnlyHint": False, "destructiveHint": True},
         "inputSchema": {"type": "object"}},
    ]


class FakeTransport:
    def __init__(self, tools=None, call_result=None, failures=0, status=200):
        self.tools = tools if tools is not None else live_tools()
        self.call_result = call_result or {
            "content": [{"type": "text", "text": json.dumps({"score": 0})}]}
        self.failures = failures
        self.status = status
        self.payloads = []

    def __call__(self, payload):
        self.payloads.append(payload)
        if self.failures:
            self.failures -= 1
            raise ConnectionError("boom")
        if payload["method"] == "tools/list":
            return self.status, {"jsonrpc": "2.0", "id": payload["id"],
                                 "result": {"tools": self.tools}}
        return self.status, {"jsonrpc": "2.0", "id": payload["id"], "result": self.call_result}

    def calls(self):
        return [p for p in self.payloads if p["method"] == "tools/call"]


@pytest.fixture
def registry():
    return m.load_registry()


def client(registry, transport):
    return m.HostedMCPClient(registry, transport=transport, sleep=lambda _s: None)


def test_shipped_registry_loads_and_is_consistent(registry):
    assert registry.endpoint == "https://authichain.com/mcp"
    executable = {c["id"] for c in registry.capabilities.values() if c["agentz_executable"]}
    assert "authichain.mcp.dpp_readiness_check" in executable
    for c in registry.capabilities.values():
        if c["risk"] in ("financial", "host_executable_verifier"):
            assert c["agentz_executable"] is False, c["id"]
    assert registry.capabilities["authichain.mcp.verify"]["status"] == "BLOCKED"
    assert registry.capabilities["agentz.scan.local_signature"]["status"] == "BLOCKED"


def write(tmp_path, entries):
    doc = {"schema_version": 1, "registry_version": 1, "baseline_revision": "x",
           "hosted_mcp_endpoint": "https://example.invalid/mcp", "capabilities": entries}
    p = tmp_path / "r.yaml"
    p.write_text(yaml.safe_dump(doc))
    return p


def entry(**over):
    e = {"id": "a", "name": "n", "purpose": "p", "source": "s",
         "entrypoint": {"adapter": "mcp", "tool": "get_pricing"}, "risk": "read_only",
         "policy_capability": "research", "status": "AVAILABLE", "agentz_executable": True}
    e.update(over)
    return e


@pytest.mark.parametrize("bad", [
    [entry(status="PARTIAL")],                                  # executable but not AVAILABLE
    [entry(risk="financial")],                                  # executable but not read_only
    [entry(policy_capability="payment")],                       # governed capability
    [entry(), entry()],                                         # duplicate id
    [entry(status="NOPE", agentz_executable=False)],            # unknown status
    [entry(status="BLOCKED", agentz_executable=False)],         # BLOCKED without blocker
])
def test_invalid_registries_fail_closed(tmp_path, bad):
    with pytest.raises(m.CapabilityError) as exc:
        m.load_registry(write(tmp_path, bad))
    assert exc.value.code == "registry_invalid"


def test_call_returns_parsed_receipt(registry):
    t = FakeTransport()
    out = client(registry, t).call("authichain.mcp.dpp_readiness_check", {"category": "textiles"})
    assert out["ok"] is True and out["result"] == {"score": 0}
    assert out["tool"] == "dpp_readiness_check"
    assert t.calls()[0]["params"] == {"name": "dpp_readiness_check",
                                      "arguments": {"category": "textiles"}}


def test_schema_violation_never_reaches_server(registry):
    t = FakeTransport()
    with pytest.raises(m.CapabilityError) as exc:
        client(registry, t).call("authichain.mcp.dpp_readiness_check", {})
    assert exc.value.code == "invalid_arguments"
    assert t.calls() == []


def test_blocked_paid_tool_is_refused_without_network(registry):
    t = FakeTransport()
    with pytest.raises(m.CapabilityError) as exc:
        client(registry, t).call("authichain.mcp.verify", {})
    assert exc.value.code == "not_executable"
    assert t.payloads == []


def test_live_annotation_change_blocks_call(registry):
    tools = live_tools()
    tools[0]["annotations"] = {"readOnlyHint": False, "destructiveHint": True}
    t = FakeTransport(tools=tools)
    c = client(registry, t)
    with pytest.raises(m.CapabilityError) as exc:
        c.call("authichain.mcp.get_pricing")
    assert exc.value.code == "live_not_read_only"
    assert t.calls() == []
    assert "get_pricing" in c.drift()["executable_but_live_not_read_only"]


def test_tool_missing_live_is_refused(registry):
    t = FakeTransport(tools=[])
    with pytest.raises(m.CapabilityError) as exc:
        client(registry, t).call("authichain.mcp.get_pricing")
    assert exc.value.code == "not_live"


def test_unknown_and_non_mcp_capabilities_refused(registry):
    c = client(registry, FakeTransport())
    with pytest.raises(m.CapabilityError) as exc:
        c.call("does.not.exist")
    assert exc.value.code == "unknown_capability"
    with pytest.raises(m.CapabilityError) as exc:
        c.call("agentz.control_plane.state")
    assert exc.value.code == "wrong_adapter"


def test_drift_reports_both_directions(registry):
    tools = live_tools() + [{"name": "brand_new_tool", "annotations": READ_ONLY}]
    d = client(registry, FakeTransport(tools=tools)).drift()
    assert d["unregistered_live_tools"] == ["brand_new_tool"]
    assert "scan_living_qr" in d["registered_but_not_live"]


def test_transient_failures_retry_with_bound(registry):
    t = FakeTransport(failures=2)
    assert "get_pricing" in client(registry, t).discover()
    assert len(t.payloads) == 3

    t = FakeTransport(failures=5)
    with pytest.raises(m.CapabilityError) as exc:
        client(registry, t).discover()
    assert exc.value.code == "upstream_unavailable"
    assert len(t.payloads) == m.MAX_ATTEMPTS


def test_client_errors_are_not_retried(registry):
    t = FakeTransport(status=403)
    with pytest.raises(m.CapabilityError) as exc:
        client(registry, t).discover()
    assert exc.value.code == "upstream_rejected"
    assert len(t.payloads) == 1


def test_rpc_tool_error_flag_is_surfaced(registry):
    t = FakeTransport(call_result={"isError": True,
                                   "content": [{"type": "text", "text": "nope"}]})
    out = client(registry, t).call("authichain.mcp.get_pricing")
    assert out["ok"] is False and out["result"] == "nope"


def test_cli_list_needs_no_network(capsys):
    assert m.cli_capabilities("list", status="BLOCKED") == 0
    out = capsys.readouterr().out
    assert "authichain.mcp.verify" in out and "AVAILABLE" not in out
