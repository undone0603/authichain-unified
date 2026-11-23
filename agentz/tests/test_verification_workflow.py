"""verify_request workflow: positive, negative, timeout and authorization cases. No network."""
import json

import pytest

from agentz.core import verification_workflow as vw
from agentz.core.modes import ExecutionContext, Mode
from agentz.integrations import authichain_mcp as m
from agentz.workflows.handlers import verify_request as handler

RO = {"readOnlyHint": True, "destructiveHint": False}
OBJ = {"type": "object"}

PROD_RECORD = {"verdict": "verified", "demonstration": False,
               "signer": {"productionIssuer": True}}
DEMO_RECORD = {"verdict": "verified", "demonstration": True,
               "signer": {"productionIssuer": False}}
PROVENANCE = {"status": "registered", "verified": True, "product": {"name": "x"},
              "registry": {"state": "ok"}}
ATTESTED = {"verified": True, "status": "verified"}
ATTEST_DOWN = {"verified": False, "status": "registry_unavailable", "error": "down"}


def tools(annotations=RO):
    return [{"name": n, "annotations": annotations, "inputSchema": OBJ}
            for n in ("verify_record", "query_provenance", "verify_attestation")]


class Transport:
    def __init__(self, results, tool_list=None, fail_calls=False):
        self.results = results
        self.tool_list = tool_list if tool_list is not None else tools()
        self.fail_calls = fail_calls
        self.calls = []

    def __call__(self, payload):
        if payload["method"] == "tools/list":
            return 200, {"result": {"tools": self.tool_list}}
        if self.fail_calls:
            raise TimeoutError("read timeout")
        name = payload["params"]["name"]
        self.calls.append((name, payload["params"]["arguments"]))
        return 200, {"result": {"content": [{"type": "text",
                                             "text": json.dumps(self.results[name])}]}}


def client(transport):
    return m.HostedMCPClient(m.load_registry(), transport=transport, sleep=lambda _s: None)


def test_full_request_produces_traceable_receipt():
    t = Transport({"verify_record": PROD_RECORD, "query_provenance": PROVENANCE,
                   "verify_attestation": ATTESTED})
    r = vw.run_verification(client(t), {"record_id": "r1", "asset_id": "a1"},
                            execution_id="exec-1")
    assert r["execution_id"] == "exec-1" and r["verdict"] == "verified"
    assert [s["capability_id"] for s in r["steps"]] == [
        vw.VERIFY_RECORD, vw.QUERY_PROVENANCE, vw.VERIFY_ATTESTATION]
    assert all(s["result_digest"].startswith("sha256:") for s in r["steps"])
    assert r["provenance"]["registry_state"] == "ok"
    assert r["physical_authenticity"] == "not_inspected"
    assert t.calls[0] == ("verify_record", {"id": "r1"})
    assert r["request_digest"] == vw.digest({"record_id": "r1", "asset_id": "a1"})


def test_demonstration_record_is_never_reported_verified():
    t = Transport({"verify_record": DEMO_RECORD})
    r = vw.run_verification(client(t), {"record_id": "polygon-anchor-1"})
    assert r["verdict"] == "verified_demonstration_only"


def test_unavailable_attestation_registry_makes_result_inconclusive():
    t = Transport({"verify_record": PROD_RECORD, "query_provenance": PROVENANCE,
                   "verify_attestation": ATTEST_DOWN})
    r = vw.run_verification(client(t), {"record_id": "r1", "asset_id": "a1"})
    assert r["steps"][2]["verdict"] == "inconclusive"
    assert r["verdict"] == "inconclusive"


@pytest.mark.parametrize("bad", [
    {},                                             # nothing to verify
    {"record_id": "r", "record": {}},               # both record forms
    {"anchor": {}, "asset_id": "a"},                # anchor without record
    {"asset_id": ""},                               # empty id
    {"asset_id": "a", "extra": 1},                  # unknown field
])
def test_invalid_requests_are_refused_before_network(bad):
    t = Transport({})
    with pytest.raises(m.CapabilityError) as exc:
        vw.run_verification(client(t), bad)
    assert exc.value.code == "invalid_request"
    assert t.calls == []


def test_timeouts_are_bounded_and_inconclusive():
    t = Transport({}, fail_calls=True)
    r = vw.run_verification(client(t), {"asset_id": "a1"})
    assert r["verdict"] == "inconclusive"
    assert {s["error"] for s in r["steps"]} == {"upstream_unavailable"}


def test_tool_that_turns_non_read_only_is_not_called():
    t = Transport({}, tool_list=tools({"readOnlyHint": False, "destructiveHint": True}))
    r = vw.run_verification(client(t), {"record_id": "r1"})
    assert r["steps"][0]["error"] == "live_not_read_only"
    assert r["verdict"] == "inconclusive" and t.calls == []


def test_plan_only_uses_allowed_capabilities():
    steps = vw.plan({"record": {"a": 1}, "anchor": {"b": 2}, "asset_id": "x"})
    assert {cid for cid, _ in steps} <= vw.ALLOWED
    assert steps[0] == (vw.VERIFY_RECORD, {"record": {"a": 1}, "anchor": {"b": 2}})


def test_combine_weakest_link():
    assert vw.combine(["verified", "verified_demonstration_only"]) == "verified_demonstration_only"
    assert vw.combine(["verified", "unverified"]) == "unverified"
    assert vw.combine([]) == "inconclusive"


def test_handler_dry_run_touches_no_network(monkeypatch, tmp_path):
    def boom(*_a, **_k):
        raise AssertionError("network used in dry-run")
    monkeypatch.setattr(handler, "HostedMCPClient", boom)
    out = json.loads(handler.run(ExecutionContext(
        mode=Mode.DRY_RUN, workflow_id="verify_request",
        parameters={"record_id": "r1", "_receipts_path": str(tmp_path / "r.jsonl")})))
    assert out["plan"] == [vw.VERIFY_RECORD] and out["network"] is False
    assert not (tmp_path / "r.jsonl").exists()


def test_handler_appends_receipt(monkeypatch, tmp_path):
    t = Transport({"verify_record": DEMO_RECORD})
    monkeypatch.setattr(handler, "HostedMCPClient", lambda reg: client(t))
    path = tmp_path / "r.jsonl"
    out = json.loads(handler.run(ExecutionContext(
        mode=Mode.AUTO, workflow_id="verify_request",
        parameters={"record_id": "r1", "_receipts_path": str(path)})))
    lines = path.read_text().splitlines()
    assert len(lines) == 1 and json.loads(lines[0])["execution_id"] == out["execution_id"]


def test_handler_reports_invalid_request(tmp_path):
    out = json.loads(handler.run(ExecutionContext(
        mode=Mode.AUTO, workflow_id="verify_request",
        parameters={"_receipts_path": str(tmp_path / "r.jsonl")})))
    assert out["error"] == "invalid_request"
