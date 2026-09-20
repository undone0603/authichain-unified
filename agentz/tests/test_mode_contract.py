"""Claw ↔ AgentZ mode contract — query + body, architect/email fail-closed."""

from __future__ import annotations

from agentz.api.mode_contract import (
    is_fail_closed_workflow,
    resolve_execution_mode,
)


def test_query_mode_is_honored():
    mode, coerced, live = resolve_execution_mode(
        query_mode="confirm",
        body={"mode": "dry-run"},
        workflow_id="stripe_mcp",
    )
    assert mode == "confirm"
    assert coerced is False
    assert live is False


def test_json_body_mode_is_honored_when_query_omitted():
    mode, coerced, live = resolve_execution_mode(
        query_mode=None,
        body={"mode": "auto"},
        workflow_id="stripe_mcp",
    )
    assert mode == "auto"
    assert coerced is False
    assert live is False


def test_missing_mode_defaults_dry_run():
    mode, coerced, live = resolve_execution_mode(workflow_id="stripe_mcp")
    assert mode == "dry-run"
    assert coerced is False
    assert live is False


def test_invalid_mode_defaults_dry_run():
    mode, _, _ = resolve_execution_mode(
        query_mode="yolo",
        body={"mode": "please"},
        workflow_id="stripe_mcp",
    )
    assert mode == "dry-run"


def test_architect_fail_closed_without_live_flag():
    mode, coerced, live = resolve_execution_mode(
        query_mode="auto",
        body={"mode": "auto"},
        workflow_id="architect_cycle",
        endpoint="architect",
    )
    assert mode == "dry-run"
    assert coerced is True
    assert live is False


def test_architect_live_flag_honors_requested_mode():
    mode, coerced, live = resolve_execution_mode(
        query_mode="auto",
        live_query=True,
        endpoint="architect",
    )
    assert mode == "auto"
    assert coerced is False
    assert live is True


def test_cold_email_fail_closed_without_live_flag():
    mode, coerced, _ = resolve_execution_mode(
        body={"mode": "confirm"},
        workflow_id="strainchain_email_pitch",
    )
    assert mode == "dry-run"
    assert coerced is True


def test_cold_email_live_body_flag():
    mode, coerced, live = resolve_execution_mode(
        body={"mode": "confirm", "live": True},
        workflow_id="authichain_crm_outreach",
    )
    assert mode == "confirm"
    assert coerced is False
    assert live is True


def test_fail_closed_classifier():
    assert is_fail_closed_workflow(None, "architect") is True
    assert is_fail_closed_workflow("architect_cycle") is True
    assert is_fail_closed_workflow("strainchain_email_pitch") is True
    assert is_fail_closed_workflow("stripe_mcp") is False


def test_live_flag_without_mode_promotes_social_to_auto():
    mode, coerced, live = resolve_execution_mode(
        live_query=True,
        workflow_id="authichain_social_launch_orchestrated",
    )
    assert mode == "auto"
    assert live is True
    assert coerced is False


def test_explicit_dry_run_wins_even_with_live_flag():
    mode, coerced, live = resolve_execution_mode(
        query_mode="dry-run",
        live_query=True,
        workflow_id="linkedin_post",
    )
    assert mode == "dry-run"
    assert live is True
    assert coerced is False


def test_live_flag_without_mode_does_not_promote_email():
    mode, coerced, live = resolve_execution_mode(
        live_query=True,
        workflow_id="strainchain_email_pitch",
    )
    assert mode == "dry-run"
    assert live is True
    assert coerced is False
