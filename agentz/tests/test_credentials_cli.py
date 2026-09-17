"""Credential inventory, placeholder-aware preflight, and registry CLI."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from agentz.core import credentials as creds
from agentz.core.credentials import (
    CRITICAL_CREDS,
    DPP_LOOP_CREDS,
    check_all,
    credential_snapshot,
    inventory,
    is_unset_or_placeholder,
)
from agentz.core.runner import load_registry
from agentz.cli import main


@pytest.fixture(autouse=True)
def _skip_dotenv(monkeypatch):
    """Don't let the repo .env leak into presence checks."""
    monkeypatch.setattr(creds, "_loaded", True)
    monkeypatch.setattr(creds, "_env_path", Path("/dev/null"))


def test_placeholder_detection():
    assert is_unset_or_placeholder(None)
    assert is_unset_or_placeholder("")
    assert is_unset_or_placeholder("   ")
    assert is_unset_or_placeholder("TODO_PASTE")
    assert is_unset_or_placeholder("TODO_PASTE_OR_GENERATE")
    assert is_unset_or_placeholder("changeme")
    assert not is_unset_or_placeholder("sk_live_not_a_real_key_but_set")


def test_check_all_treats_placeholders_as_missing(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "TODO_PASTE")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    present, missing = check_all(["stripe_secret", "supabase_url"])
    assert "stripe_secret" in missing
    assert "supabase_url" in present


def test_inventory_never_includes_secret_values(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_super_secret_value")
    monkeypatch.delenv("AGENT_SECRET", raising=False)
    data = inventory(keys=["stripe_secret", "agent_secret"])
    blob = json.dumps(data)
    assert "sk_test_super_secret_value" not in blob
    stripe = next(i for i in data["items"] if i["key"] == "stripe_secret")
    assert stripe["present"] is True
    assert stripe["length"] == len("sk_test_super_secret_value")
    assert data["present_count"] == 1
    assert data["missing_count"] == 1


def test_inventory_missing_only(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.delenv("AGENT_SECRET", raising=False)
    data = inventory(missing_only=True, keys=["stripe_secret", "agent_secret"])
    assert [i["key"] for i in data["items"]] == ["agent_secret"]
    assert data["present_count"] == 1
    assert data["missing_count"] == 1


def test_dpp_loop_creds_cover_critical_plus_resend():
    assert set(CRITICAL_CREDS) <= set(DPP_LOOP_CREDS)
    assert "resend_api_key" in DPP_LOOP_CREDS


def test_credential_snapshot_critical_vs_extra(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service_role_test_value")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_not_a_live_key")
    monkeypatch.setenv("AGENT_SECRET", "agent-secret-test-value")
    monkeypatch.delenv("PINECONE_API_KEY", raising=False)
    snap = credential_snapshot(extra_required=["pinecone_api_key"])
    assert snap["secrets_present"] is True
    assert snap["missing_credentials"] == []
    assert "pinecone_api_key" in snap["missing_workflow_credentials"]


def test_cli_creds_critical_exits_1_when_missing(monkeypatch, capsys):
    for env in (
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "STRIPE_SECRET_KEY",
        "AGENT_SECRET",
        "RESEND_API_KEY",
    ):
        monkeypatch.delenv(env, raising=False)
    rc = main(["creds", "--critical"])
    out = capsys.readouterr().out
    payload = json.loads(out)
    assert rc == 1
    assert payload["missing_count"] == len(DPP_LOOP_CREDS)
    assert "sk_" not in out
    assert any(i["key"] == "stripe_secret" for i in payload["items"])


def test_cli_list_includes_launch_governor(capsys):
    rc = main(["list"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "launch_governor" in out
    assert "confirm" in out


def test_cli_list_revenue_only_json(capsys):
    rc = main(["list", "--revenue-only", "--json"])
    payload = json.loads(capsys.readouterr().out)
    assert rc == 0
    assert payload
    assert all(item["blocks_revenue"] for item in payload)


def test_cli_run_all_auto_refused(capsys):
    rc = main(["run", "--all", "--mode", "auto"])
    err = capsys.readouterr().err
    assert rc == 2
    assert "Refusing" in err


def test_cli_run_unknown_id(capsys):
    rc = main(["run", "definitely_not_a_workflow", "--mode", "dry-run"])
    assert rc == 2
    assert "Unknown workflow" in capsys.readouterr().err


def test_registry_has_launch_governor():
    registry = load_registry()
    assert "launch_governor" in registry
    assert registry["launch_governor"].handler == "handlers.launch.governor"


def test_cli_help_mentions_creds(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0
    assert "creds" in capsys.readouterr().out


def test_governor_secrets_present_is_critical_keys_only(monkeypatch, tmp_path):
    """Full-map green is not required; the four launch-gate keys are."""
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service_role_test_value")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_not_a_live_key")
    monkeypatch.setenv("AGENT_SECRET", "agent-secret-test-value")
    monkeypatch.delenv("PINECONE_API_KEY", raising=False)
    from agentz.core.governor import LaunchGovernor
    from agentz.core.modes import Mode

    gov = LaunchGovernor(mode=Mode.DRY_RUN, audit_log_path=tmp_path / "audit.jsonl")
    ctx = gov._observe()
    assert ctx["secrets_present"] is True
    assert ctx["missing_credentials"] == []
    assert "missing_workflow_credentials" in ctx
    assert "pinecone_api_key" in ctx["missing_workflow_credentials"]
