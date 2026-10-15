"""Tests for agentz.core.autonomy_policy: kill switch, policy, approvals."""
from __future__ import annotations

import pytest

from agentz.core import autonomy_policy as ap


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENTZ_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("AGENTZ_KILL_FILE", str(tmp_path / "KILL"))
    monkeypatch.delenv("AGENTZ_KILL_SWITCH", raising=False)


# --- kill switch ----------------------------------------------------------
def test_kill_switch_off_by_default():
    assert ap.kill_switch_status() == (False, "")


@pytest.mark.parametrize("value", ["1", "true", "YES", "on"])
def test_kill_switch_env_var(monkeypatch, value):
    monkeypatch.setenv("AGENTZ_KILL_SWITCH", value)
    engaged, reason = ap.kill_switch_status()
    assert engaged and "AGENTZ_KILL_SWITCH" in reason


def test_kill_switch_falsey_env_var_does_not_engage(monkeypatch):
    monkeypatch.setenv("AGENTZ_KILL_SWITCH", "0")
    assert ap.kill_switch_status()[0] is False


def test_kill_file_roundtrip():
    ap.engage_kill_switch("maintenance window")
    engaged, reason = ap.kill_switch_status()
    assert engaged and "maintenance window" in reason
    assert ap.release_kill_switch() is True
    assert ap.kill_switch_status()[0] is False
    assert ap.release_kill_switch() is False


# --- policy ---------------------------------------------------------------
ENTRIES = [
    {
        "id": "wf_alpha",
        "handler": "handlers.alpha",
        "confirm_before_run": True,
        "risk_class": "HIGH",
        "financial_limit_usd": 5,
        "max_attempts": 9,
        "prerequisites": ["wf_beta"],
        "requires": ["api_key"],
        "type": "browser",
    },
    {"id": "wf_beta", "handler": "handlers.beta"},
]


def test_unknown_workflow_gets_legacy_defaults():
    p = ap.policy_for("nope", entries=ENTRIES)
    assert (p.risk_class, p.financial_limit_usd, p.requires_human_approval) == ("medium", 100.0, False)
    assert p.from_registry is False


def test_policy_resolves_by_id_and_by_handler_name():
    by_id = ap.policy_for("wf_alpha", entries=ENTRIES)
    by_handler = ap.policy_for("alpha", entries=ENTRIES)
    assert by_id == by_handler
    assert by_id.requires_human_approval is True
    assert by_id.risk_class == "high"
    assert by_id.financial_limit_usd == 5.0
    assert by_id.max_attempts == 5  # clamped
    assert by_id.prerequisites == ("wf_beta",)
    assert by_id.type == "browser" and by_id.from_registry is True


def test_entry_without_optional_fields_keeps_defaults():
    p = ap.policy_for("beta", entries=ENTRIES)
    assert (p.risk_class, p.financial_limit_usd, p.max_attempts) == ("medium", 100.0, 1)
    assert p.requires_human_approval is False


def test_bad_risk_class_fails_closed():
    p = ap.policy_for("x", entries=[{"id": "x", "risk_class": "hgih"}])
    assert p.risk_class == "high"


def test_bad_numbers_fall_back_to_defaults():
    p = ap.policy_for("x", entries=[{"id": "x", "financial_limit_usd": "lots", "max_attempts": "many"}])
    assert p.financial_limit_usd == 100.0 and p.max_attempts == 1


def test_real_registry_loads_and_resolves():
    pytest.importorskip("yaml")
    entries = ap.load_registry()
    assert entries, "registry.yaml should load (PyYAML installed)"
    first = entries[0]["id"]
    assert ap.policy_for(first, entries=entries).from_registry is True


# --- approvals ------------------------------------------------------------
def test_approval_lifecycle_is_single_use():
    rid = ap.request_approval("wf_alpha", "auto", "confirm_before_run")
    assert ap.request_approval("wf_alpha", "auto", "again") == rid  # deduplicated
    assert ap.consume_approval("wf_alpha") is False  # still pending
    assert ap.decide(rid, True, by="zac") is True
    assert ap.consume_approval("wf_alpha") is True
    assert ap.consume_approval("wf_alpha") is False  # already spent
    assert ap.list_requests()[0]["status"] == "consumed"


def test_rejected_request_never_authorises():
    rid = ap.request_approval("wf_alpha", "auto", "r")
    assert ap.decide(rid, False, by="zac", note="not now") is True
    assert ap.consume_approval("wf_alpha") is False
    assert ap.decide(rid, True) is False  # cannot flip a decided request


def test_expired_request_never_authorises():
    rid = ap.request_approval("wf_alpha", "auto", "r", ttl_hours=-1)
    assert ap.list_requests()[0]["status"] == "expired"
    assert ap.decide(rid, True) is False
    assert ap.consume_approval("wf_alpha") is False


def test_unknown_request_id_cannot_be_approved():
    assert ap.decide("does-not-exist", True) is False


def test_torn_log_line_is_ignored():
    rid = ap.request_approval("wf_alpha", "auto", "r")
    with ap.approvals_path().open("a", encoding="utf-8") as fh:
        fh.write('{"event": "approve", "id": "' + rid)  # truncated, no newline
    assert ap.consume_approval("wf_alpha") is False
    assert ap.list_requests()[0]["status"] == "pending"


# --- unreadable registry must not silently disable the gate ----------------
def _bad_registry(tmp_path):
    bad = tmp_path / "registry.yaml"
    bad.write_text("workflows: [unclosed", encoding="utf-8")
    return bad


def test_missing_registry_file_means_no_entries(tmp_path):
    assert ap.load_registry(tmp_path / "nope.yaml") == []


def test_unreadable_registry_raises_instead_of_failing_open(tmp_path):
    with pytest.raises(ap.PolicyUnavailable):
        ap.load_registry(_bad_registry(tmp_path))


def test_policy_for_degrades_with_loud_warning_by_default(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(ap, "REGISTRY_PATH", _bad_registry(tmp_path))
    monkeypatch.delenv("AGENTZ_POLICY_STRICT", raising=False)
    policy = ap.policy_for("anything")
    assert policy.from_registry is False
    assert "confirm_before_run is NOT enforced" in capsys.readouterr().err


def test_policy_for_refuses_in_strict_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(ap, "REGISTRY_PATH", _bad_registry(tmp_path))
    monkeypatch.setenv("AGENTZ_POLICY_STRICT", "1")
    with pytest.raises(ap.PolicyUnavailable):
        ap.policy_for("anything")
