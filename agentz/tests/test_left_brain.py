"""Left-Side Brain cycle against the existing launch state machine."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agentz.core.launch_state import STAGE_ORDER, LaunchStage, LaunchStateMachine
from agentz.core.left_brain import (
    DECISION_FIELDS,
    VALUE_CLASSES,
    LeftBrain,
    classify_facts,
    cycle,
    priority_score,
    separate_value,
    summarize_history,
)


def _machine(tmp: Path) -> LaunchStateMachine:
    return LaunchStateMachine(state_file=tmp / "launch_state.json")


def _advance_signal(**overrides):
    signal = {
        "bottleneck": "Pilot count is the open gate",
        "decision_id": "advance-pilots",
        "approval": True,
        "gate_context": {"active_pilots": 3},
        "resources": {"human_attention": 5, "money": 0},
        "opportunities": [
            {
                "id": "advance-pilots",
                "action": "advance_if_gates_pass",
                "value": 4,
                "probability": 0.5,
                "urgency": 2,
                "cost": 2,
                "risk": 2,
                "reversibility": 1,
                "resources": {"human_attention": 1},
            }
        ],
    }
    signal.update(overrides)
    return signal


def test_assumptions_do_not_become_facts():
    facts = classify_facts({
        "verified_facts": ["A buyer exists somewhere", "The caller checked one gate."],
        "observations": ["A buyer exists somewhere"],
        "assumptions": ["A buyer exists somewhere"],
        "estimates": ["Maybe three pilots"],
        "hypotheses": ["A smaller probe might move that state."],
        "unknowns": ["Which gate is actually open"],
    })
    assert facts["verified_facts"] == ["The caller checked one gate."]
    assert "A buyer exists somewhere" in facts["assumptions"]
    assert "Maybe three pilots" not in facts["verified_facts"]


def test_empty_signal_idles_and_leaves_the_machine_at_boot(tmp_path: Path):
    sm = _machine(tmp_path)
    before = sm.current_stage
    result = cycle({}, state_machine=sm)
    assert result["mode"] == "IDLE / MONITOR"
    assert result["decisions"] == []
    assert result["verification"]["success"] is False
    assert result["economics"]["cash_realized"] is None
    assert result["revenue_ledger_written"] is False
    assert all(value == "denied" for value in result["authority_denials"].values())
    assert sm.current_stage == before == LaunchStage.BOOT
    assert result["state"]["current_stage"] == sm.current_stage.value
    assert result["state"]["source"] == "LaunchStateMachine"


def test_state_snapshot_follows_the_machine_and_drops_caller_claims(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    context = {"active_pilots": 2}
    direct = sm.assess_stage(context=context)
    result = cycle(
        {
            "gate_context": context,
            "assumptions": ["send_mail is running"],
            "workflows": ["send_mail"],
            "tasks": ["email the buyer"],
            "deadlines": ["2026-11-06"],
            "mission_state": {"stage": "SCALE"},
            "economics": {"pipeline_value": 499, "revenue": 499.95},
            "approval": "yes",
            "resources": {"human_attention": 1, "money": 0},
        },
        state_machine=sm,
    )
    state = result["state"]
    assert state["mission_state"]["stage"] == sm.current_stage.value == "3_PILOTS"
    assert state["mission_state"]["source"] == "LaunchStateMachine"
    assert state["mission_state"]["history_count"] == len(sm.to_dict()["history"])
    assert state["dependencies"] == direct.blocking_gates
    assert state["failures"] == 0
    assert state["approvals"]["advance"] is False
    assert state["financial_state"]["pipeline_value"] == 499
    assert state["financial_state"]["cash_realized"] is None
    assert "revenue" not in state["financial_state"]
    assert state["workflows"] == {"status": "unknown", "verified": False, "items": []}
    assert state["tasks"] == {"status": "unknown", "verified": False, "items": []}
    assert state["deadlines"] == {"status": "unknown", "verified": False, "items": []}
    assert state["opportunities"] == {"status": "unknown", "verified": False, "items": []}
    assert state["resources"]["available"]["human_attention"] == result["resources"]["available"]["human_attention"]
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_state_read_matches_the_live_machine(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    context = {"active_pilots": 2}
    direct = sm.assess_stage(context=context)
    result = cycle(
        {
            "bottleneck": "Two pilots are recorded",
            "gate_context": context,
            "resources": {"human_attention": 1},
            "opportunities": [
                {
                    "id": "read",
                    "action": "read_state",
                    "value": 1,
                    "probability": 1,
                    "urgency": 1,
                    "cost": 1,
                    "risk": 1,
                    "reversibility": 1,
                    "resources": {"human_attention": 1},
                }
            ],
        },
        state_machine=sm,
    )
    assert result["state"]["current_stage"] == "3_PILOTS"
    assert result["state"]["ready_to_advance"] is direct.ready_to_advance
    assert result["state"]["passed"] == direct.passed
    assert result["state"]["failed"] == direct.failed
    assert result["state"]["blocking_gates"] == direct.blocking_gates
    assert result["verification"]["success"] is False
    assert result["verification"]["executed"] is True
    assert result["verification"]["external_state_changed"] is False
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_priority_formula_orders_work_and_rejects_a_zero_denominator():
    high = priority_score(4, 0.5, 2, 2, 2, 1)
    low = priority_score(1, 0.5, 1, 2, 2, 1)
    assert high["rankable"] is True
    assert low["rankable"] is True
    assert high["score"] == round((4 * 0.5 * 2) / (2 * 2 * 1), 6)
    assert high["score"] > low["score"]
    blocked = priority_score(4, 0.5, 2, 0, 2, 1)
    assert blocked["rankable"] is False
    assert blocked["score"] is None


def test_decision_record_and_separated_economics(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    result = cycle(
        {
            "bottleneck": "Pilot count is the open gate",
            "verified_facts": ["Two pilots are already on the record"],
            "assumptions": ["A third pilot is about to pay"],
            "gate_context": {"active_pilots": 2},
            "economics": {
                "pipeline_value": 10,
                "cash_realized": None,
                "revenue": 10,
            },
            "resources": {"human_attention": 1},
            "opportunities": [
                {
                    "id": "low",
                    "action": "read_state",
                    "value": 1,
                    "probability": 0.5,
                    "urgency": 1,
                    "cost": 2,
                    "risk": 2,
                    "reversibility": 1,
                    "resources": {"human_attention": 1},
                },
                {
                    "id": "high",
                    "action": "read_state",
                    "value": 4,
                    "probability": 0.5,
                    "urgency": 2,
                    "cost": 2,
                    "risk": 2,
                    "reversibility": 1,
                    "resources": {"human_attention": 1},
                },
            ],
        },
        state_machine=sm,
    )
    decision = result["decisions"][0]
    assert set(decision) == set(DECISION_FIELDS)
    assert decision["evidence"] == ["Two pilots are already on the record"]
    assert "A third pilot is about to pay" not in decision["evidence"]
    assert result["priorities"][0]["id"] == "high"
    assert result["resources"]["highest_value_use"] == "high"
    assert result["economics"]["pipeline_value"] == 10
    assert result["economics"]["cash_realized"] is None
    assert "revenue" not in result["economics"]
    assert set(result["economics"]) == set(VALUE_CLASSES)
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_spend_and_mode_auto_stop_before_the_machine_moves(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    brain = LeftBrain(sm)
    denied = brain.cycle(_advance_signal(requested_authority="AgentZ --mode auto"))
    assert denied["mode"] == "STOP"
    assert denied["stopped"] is True
    assert "authority_violation" in denied["risks"]
    assert denied["authority_denials"]["AgentZ --mode auto"] == "denied"
    assert denied["authority_boundary_modified"] is False
    assert sm.current_stage == LaunchStage.THREE_PILOTS
    assert brain.execution_attempts == 0

    spend = brain.cycle(
        _advance_signal(
            decision_id="spend-attempt",
            resources={"human_attention": 5, "money": 5},
            opportunities=[
                {
                    "id": "buy",
                    "action": "advance_if_gates_pass",
                    "value": 9,
                    "probability": 1,
                    "urgency": 1,
                    "cost": 1,
                    "risk": 1,
                    "reversibility": 1,
                    "resources": {"money": 1, "human_attention": 1},
                }
            ],
        )
    )
    assert spend["mode"] == "STOP"
    assert "abnormal_spending" in spend["risks"]
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_unfunded_spend_stops_as_abnormal_spending(tmp_path: Path):
    """A spend the budget cannot cover is still a spend, not a capacity miss."""
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    blocked = cycle(
        _advance_signal(
            decision_id="unfunded-spend",
            opportunities=[
                {
                    "id": "buy",
                    "action": "advance_if_gates_pass",
                    "value": 4,
                    "probability": 0.5,
                    "urgency": 2,
                    "cost": 2,
                    "risk": 2,
                    "reversibility": 1,
                    "resources": {"money": 1, "human_attention": 1},
                }
            ],
        ),
        state_machine=sm,
    )
    assert blocked["mode"] == "STOP"
    assert blocked["risks"] == ["abnormal_spending"]
    assert "resource_exhaustion" not in blocked["risks"]
    assert blocked["stopped"] is True
    assert blocked["verification"]["success"] is False
    assert blocked["execution"]["attempts"] == 0
    assert blocked["economics"]["cash_realized"] is None
    assert blocked["revenue_ledger_written"] is False
    assert blocked["authority_boundary_modified"] is False
    assert blocked["decisions"][0]["decision"] == "stop"
    assert "spend" in blocked["decisions"][0]["reason"].lower()
    assert sm.current_stage == LaunchStage.THREE_PILOTS
    assert LaunchStateMachine(state_file=sm.state_file).current_stage == LaunchStage.THREE_PILOTS


def test_approved_advance_uses_the_real_machine_once(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    brain = LeftBrain(sm)
    signal = _advance_signal()
    first = brain.cycle(signal)
    assert first["verification"]["success"] is True
    assert first["verification"]["external_state_changed"] is True
    assert first["verification"]["evidence"]
    assert first["economics"]["cash_realized"] is None
    assert sm.current_stage == LaunchStage.FIRST_REVENUE
    index = STAGE_ORDER.index(LaunchStage.THREE_PILOTS)
    assert sm.current_stage == STAGE_ORDER[index + 1]
    reread = LaunchStateMachine(state_file=sm.state_file)
    assert reread.current_stage == sm.current_stage

    second = brain.cycle(signal)
    assert second["execution"]["status"] == "idempotent_skip"
    assert second["verification"]["success"] is False
    assert sm.current_stage == LaunchStage.FIRST_REVENUE
    assert brain.execution_attempts == 1


def test_failed_gates_are_not_success_and_a_third_try_stops(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    brain = LeftBrain(sm)
    failing = _advance_signal(gate_context={"active_pilots": 0}, decision_id="retry-pilots")
    first = brain.cycle(failing)
    second = brain.cycle({**failing, "decision_id": "retry-pilots-2"})
    assert first["verification"]["success"] is False
    assert second["verification"]["success"] is False
    assert sm.current_stage == LaunchStage.THREE_PILOTS
    assert brain.execution_attempts == 2
    assert brain.failures == 2
    third = brain.cycle({**failing, "decision_id": "retry-pilots-3"})
    assert third["mode"] == "STOP"
    assert "repeated_failures" in third["risks"]
    assert brain.execution_attempts == 2
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_non_attention_resources_stop_or_redirect_without_a_spend(tmp_path: Path):
    """Compute, tokens, time, api, and system capacity constrain the live machine.

    A short dimension stops the advance. It is not a spend. A lower-ranked
    action that fits is the use of what is still available.
    """
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    pool = {
        "human_attention": 5,
        "money": 0,
        "compute": 5,
        "tokens": 5,
        "time": 5,
        "api": 5,
        "system_capacity": 5,
    }
    for kind in ("compute", "tokens", "time", "api", "system_capacity"):
        scarce = dict(pool)
        scarce[kind] = 0
        result = cycle(
            _advance_signal(
                decision_id=f"needs-{kind}",
                resources=scarce,
                opportunities=[
                    {
                        "id": f"needs-{kind}",
                        "action": "advance_if_gates_pass",
                        "value": 4,
                        "probability": 0.5,
                        "urgency": 2,
                        "cost": 2,
                        "risk": 2,
                        "reversibility": 1,
                        "resources": {kind: 1, "human_attention": 1},
                    }
                ],
            ),
            state_machine=sm,
        )
        assert result["mode"] == "STOP"
        assert result["risks"] == ["resource_exhaustion"]
        assert "abnormal_spending" not in result["risks"]
        assert result["verification"]["success"] is False
        assert result["execution"]["attempts"] == 0
        assert result["economics"]["cash_realized"] is None
        assert sm.current_stage == LaunchStage.THREE_PILOTS
    reread = LaunchStateMachine(state_file=sm.state_file)
    assert reread.current_stage == LaunchStage.THREE_PILOTS

    short_compute = dict(pool)
    short_compute["compute"] = 1
    redirect = cycle(
        {
            "bottleneck": "Compute is short",
            "approval": True,
            "gate_context": {"active_pilots": 3},
            "resources": short_compute,
            "opportunities": [
                {
                    "id": "heavy",
                    "action": "advance_if_gates_pass",
                    "value": 9,
                    "probability": 1,
                    "urgency": 3,
                    "cost": 1,
                    "risk": 1,
                    "reversibility": 1,
                    "resources": {"compute": 4},
                },
                {
                    "id": "light",
                    "action": "read_state",
                    "value": 1,
                    "probability": 1,
                    "urgency": 1,
                    "cost": 1,
                    "risk": 1,
                    "reversibility": 1,
                    "resources": {
                        "compute": 1,
                        "tokens": 1,
                        "time": 1,
                        "api": 1,
                        "system_capacity": 1,
                    },
                },
            ],
        },
        state_machine=sm,
    )
    assert redirect["resources"]["highest_value_use"] == "light"
    assert redirect["decisions"][0]["decision"] == "read_state"
    assert redirect["mode"] == "DECIDE"
    assert redirect["verification"]["success"] is False
    assert redirect["verification"]["external_state_changed"] is False
    assert "abnormal_spending" not in redirect["risks"]
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_attention_exhaustion_does_not_advance(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    brain = LeftBrain(sm)
    first = brain.cycle(
        _advance_signal(
            decision_id="tight-attention",
            gate_context={"active_pilots": 0},
            resources={"human_attention": 1},
        )
    )
    assert first["verification"]["success"] is False
    assert brain.execution_attempts == 1
    second = brain.cycle(
        _advance_signal(
            decision_id="tight-attention-2",
            gate_context={"active_pilots": 0},
            resources={"human_attention": 1},
        )
    )
    assert second["mode"] == "STOP"
    assert "resource_exhaustion" in second["risks"]
    assert brain.execution_attempts == 1
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_history_metrics_do_not_invent_cash():
    bare = summarize_history(None)
    assert bare["realized_revenue"] is None
    assert bare["decision_accuracy"] is None
    assert bare["source"] == "no_supplied_history"
    supplied = summarize_history([
        {
            "decision_correct": True,
            "executed": True,
            "verified": True,
            "recovered": False,
            "cost": 2,
            "useful": True,
            "escalated": False,
            "mission_violation": False,
            "unauthorized": False,
        }
    ])
    assert supplied["decision_accuracy"] == 1
    assert supplied["cost_per_useful_outcome"] == 2
    assert supplied["realized_revenue"] is None
    assert supplied["net_value"] is None
    assert supplied["idea_count_is_the_metric"] is False


def test_optimization_uses_supplied_history_and_leaves_the_machine(tmp_path: Path):
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    idle = cycle({}, state_machine=sm)
    assert idle["mode"] == "IDLE / MONITOR"
    assert idle["optimization"]["recommendations"] == {
        "works": None,
        "does_not_work": None,
        "costs_too_much": None,
        "most_value": None,
        "automate": None,
        "stop": None,
        "escalate": None,
    }
    assert idle["economics"]["cash_realized"] is None
    assert sm.current_stage == LaunchStage.THREE_PILOTS

    reviewed = cycle(
        {
            "history": [
                {
                    "id": "read",
                    "useful": True,
                    "verified": True,
                    "executed": True,
                    "cost": 1,
                    "pipeline_value": 499,
                },
                {
                    "id": "guess",
                    "useful": False,
                    "verified": False,
                    "executed": False,
                    "cost": 5,
                },
                {
                    "id": "mail",
                    "useful": False,
                    "executed": True,
                    "cost": 1,
                    "mission_violation": True,
                    "unauthorized": True,
                    "escalated": True,
                },
            ]
        },
        state_machine=sm,
    )
    rec = reviewed["optimization"]["recommendations"]
    assert rec["works"] == ["read"]
    assert rec["does_not_work"] == ["guess", "mail"]
    assert rec["costs_too_much"] == ["guess"]
    assert rec["most_value"] is None
    assert rec["automate"] is None
    assert rec["stop"] == ["mail"]
    assert rec["escalate"] == ["mail"]
    assert reviewed["optimization"]["realized_revenue"] is None
    assert reviewed["mode"] == "IDLE / MONITOR"
    assert sm.current_stage == LaunchStage.THREE_PILOTS

    paid = cycle(
        {
            "history": [
                {
                    "id": "read",
                    "useful": True,
                    "verified": True,
                    "executed": True,
                    "cost": 1,
                    "cash_realized": 2,
                },
                {
                    "id": "read",
                    "useful": True,
                    "verified": True,
                    "executed": True,
                    "cost": 1,
                    "cash_realized": 2,
                },
                {
                    "id": "read",
                    "useful": True,
                    "verified": True,
                    "executed": True,
                    "cost": 1,
                    "cash_realized": 2,
                },
                {
                    "id": "pipeline",
                    "useful": True,
                    "verified": True,
                    "executed": True,
                    "cost": 1,
                    "pipeline_value": 499,
                },
            ]
        },
        state_machine=sm,
    )
    paid_rec = paid["optimization"]["recommendations"]
    assert paid_rec["most_value"] == "read"
    assert paid_rec["automate"] == ["read"]
    assert "pipeline" not in (paid_rec["automate"] or [])
    assert paid["optimization"]["realized_revenue"] == 6
    assert paid["economics"]["cash_realized"] is None
    assert sm.current_stage == LaunchStage.THREE_PILOTS


def test_value_classes_stay_separate():
    separated = separate_value({
        "pipeline_value": 10,
        "modeled_value": 4,
        "cash_realized": None,
        "revenue": 14,
    })
    assert separated["pipeline_value"] == 10
    assert separated["modeled_value"] == 4
    assert separated["cash_realized"] is None
    assert separated["contracted_revenue"] is None
    assert "revenue" not in separated


def test_same_input_same_idle_result(tmp_path: Path):
    first = cycle({}, state_machine=_machine(tmp_path))
    second = cycle({}, state_machine=_machine(tmp_path))
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_cycle_rejects_a_substitute_machine():
    with pytest.raises(TypeError):
        LeftBrain(object())


def test_mission_drift_stops_before_the_machine_moves(tmp_path: Path):
    """A supplied mission stage that is not the machine's stage does not get an advance."""
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    drifted = cycle(
        _advance_signal(mission_state={"stage": "SCALE"}),
        state_machine=sm,
    )
    assert drifted["mode"] == "STOP"
    assert drifted["risks"] == ["mission_drift"]
    assert drifted["stopped"] is True
    assert drifted["verification"]["success"] is False
    assert drifted["execution"]["status"] == "not_run"
    assert drifted["execution"]["attempts"] == 0
    assert drifted["economics"]["cash_realized"] is None
    assert drifted["revenue_ledger_written"] is False
    assert drifted["authority_boundary_modified"] is False
    assert drifted["state"]["mission_state"]["stage"] == sm.current_stage.value == "3_PILOTS"
    assert drifted["state"]["mission_state"]["source"] == "LaunchStateMachine"
    assert drifted["decisions"][0]["decision"] == "stop"
    assert "mission" in drifted["decisions"][0]["reason"].lower()
    assert sm.current_stage == LaunchStage.THREE_PILOTS
    assert LaunchStateMachine(state_file=sm.state_file).current_stage == LaunchStage.THREE_PILOTS

    aligned = cycle(
        _advance_signal(
            decision_id="mission-matches",
            mission_state={"stage": "3_PILOTS"},
        ),
        state_machine=sm,
    )
    assert "mission_drift" not in aligned["risks"]
    assert aligned["verification"]["success"] is True
    assert aligned["economics"]["cash_realized"] is None
    assert sm.current_stage == LaunchStage.FIRST_REVENUE


def test_circular_actions_stop_without_advancing(tmp_path: Path):
    """Actions that point at each other, or at themselves, do not get an advance."""
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)

    def step(step_id: str, nxt: str, value: int) -> dict:
        return {
            "id": step_id,
            "action": "advance_if_gates_pass",
            "next": nxt,
            "value": value,
            "probability": 1,
            "urgency": 1,
            "cost": 1,
            "risk": 1,
            "reversibility": 1,
            "resources": {"human_attention": 1},
        }

    circled = cycle(
        _advance_signal(
            decision_id="circle",
            opportunities=[step("again", "later", 4), step("later", "again", 3)],
        ),
        state_machine=sm,
    )
    assert circled["mode"] == "STOP"
    assert circled["risks"] == ["circular_execution"]
    assert circled["stopped"] is True
    assert circled["verification"]["success"] is False
    assert circled["execution"]["status"] == "not_run"
    assert circled["execution"]["attempts"] == 0
    assert circled["economics"]["cash_realized"] is None
    assert circled["revenue_ledger_written"] is False
    assert circled["authority_boundary_modified"] is False
    assert circled["state"]["mission_state"]["stage"] == "3_PILOTS"
    assert circled["decisions"][0]["decision"] == "stop"
    assert "circular" in circled["decisions"][0]["reason"].lower()
    assert sm.current_stage == LaunchStage.THREE_PILOTS
    assert LaunchStateMachine(state_file=sm.state_file).current_stage == LaunchStage.THREE_PILOTS

    repeated = cycle(
        _advance_signal(
            decision_id="self-loop",
            opportunities=[step("again", "again", 4)],
        ),
        state_machine=sm,
    )
    assert repeated["mode"] == "STOP"
    assert repeated["risks"] == ["circular_execution"]
    assert repeated["verification"]["success"] is False
    assert sm.current_stage == LaunchStage.THREE_PILOTS

    plain = cycle(_advance_signal(decision_id="no-circle"), state_machine=sm)
    assert "circular_execution" not in plain["risks"]
    assert plain["verification"]["success"] is True
    assert plain["economics"]["cash_realized"] is None
    assert sm.current_stage == LaunchStage.FIRST_REVENUE


def test_unverified_claim_stops_before_the_machine_moves(tmp_path: Path):
    """A non-fact labeled as a verified fact does not get an advance."""
    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    claim = "A buyer already paid"
    blocked = cycle(
        _advance_signal(
            verified_facts=[claim],
            assumptions=[claim],
        ),
        state_machine=sm,
    )
    assert blocked["mode"] == "STOP"
    assert blocked["risks"] == ["unverified_claims"]
    assert blocked["stopped"] is True
    assert blocked["verification"]["success"] is False
    assert blocked["execution"]["status"] == "not_run"
    assert blocked["execution"]["attempts"] == 0
    assert blocked["economics"]["cash_realized"] is None
    assert blocked["revenue_ledger_written"] is False
    assert blocked["authority_boundary_modified"] is False
    assert claim not in blocked["fact_separation"]["verified_facts"]
    assert claim in blocked["fact_separation"]["assumptions"]
    assert claim not in blocked["decisions"][0]["evidence"]
    assert blocked["decisions"][0]["decision"] == "stop"
    assert "unverified" in blocked["decisions"][0]["reason"].lower()
    assert blocked["state"]["mission_state"]["stage"] == "3_PILOTS"
    assert sm.current_stage == LaunchStage.THREE_PILOTS
    assert LaunchStateMachine(state_file=sm.state_file).current_stage == LaunchStage.THREE_PILOTS

    separated = cycle(
        _advance_signal(
            decision_id="fact-kept-separate",
            verified_facts=["The caller checked the pilot gate"],
            assumptions=["A third pilot is about to pay"],
        ),
        state_machine=sm,
    )
    assert "unverified_claims" not in separated["risks"]
    assert separated["verification"]["success"] is True
    assert separated["decisions"][0]["evidence"] == ["The caller checked the pilot gate"]
    assert "A third pilot is about to pay" not in separated["decisions"][0]["evidence"]
    assert separated["economics"]["cash_realized"] is None
    assert sm.current_stage == LaunchStage.FIRST_REVENUE


def test_discovery_disagreement_escalates_and_leaves_the_stage(tmp_path: Path):
    """A supplied discovery does not get to move the launch stage, and neither does the left brain."""
    from agentz.core.right_brain import propose

    sm = _machine(tmp_path)
    sm.set_stage(LaunchStage.THREE_PILOTS)
    discovery = propose({
        "problem": "Pilot count is the open gate",
        "why_now": "The caller named this bottleneck",
        "meaningful_opportunity": True,
    })
    assert discovery["stops_before_execution"] is True
    brain = LeftBrain(sm)
    blocked = brain.cycle({**_advance_signal(), "discovery": discovery})
    assert blocked["mode"] == "ESCALATE"
    assert blocked["risks"] == ["disagreement"]
    assert blocked["human_decision_required"] is True
    assert blocked["stopped"] is True
    assert blocked["verification"]["success"] is False
    assert blocked["verification"]["external_state_changed"] is False
    assert blocked["execution"]["status"] == "escalated"
    assert blocked["execution"]["attempts"] == 0
    assert blocked["economics"]["cash_realized"] is None
    assert blocked["revenue_ledger_written"] is False
    assert blocked["authority_boundary_modified"] is False
    assert all(value == "denied" for value in blocked["authority_denials"].values())
    assert blocked["disagreement"] == {
        "left": "advance_if_gates_pass",
        "right": "stop_before_execution",
        "resolved_by": "human_decision_required",
        "checked": ["evidence", "constraints", "risk", "mission", "authority", "human_decision"],
    }
    assert sm.current_stage == LaunchStage.THREE_PILOTS
    assert LaunchStateMachine(state_file=sm.state_file).current_stage == LaunchStage.THREE_PILOTS
    assert brain.failures == 0
    assert brain.execution_attempts == 0

    forged = brain.cycle({
        **_advance_signal(decision_id="forged-execute"),
        "discovery": {"stops_before_execution": False, "mode": "EXECUTE"},
    })
    assert forged["mode"] == "ESCALATE"
    assert forged["disagreement"]["right"] == "unverified"
    assert forged["verification"]["success"] is False
    assert brain.failures == 0
    assert sm.current_stage == LaunchStage.THREE_PILOTS

    agreed = brain.cycle({
        **_advance_signal(
            decision_id="read-with-discovery",
            opportunities=[
                {
                    "id": "read",
                    "action": "read_state",
                    "value": 1,
                    "probability": 1,
                    "urgency": 1,
                    "cost": 1,
                    "risk": 1,
                    "reversibility": 1,
                    "resources": {"human_attention": 1},
                }
            ],
        ),
        "discovery": discovery,
    })
    assert agreed["mode"] == "DECIDE"
    assert agreed["decisions"][0]["decision"] == "read_state"
    assert "disagreement" not in agreed["risks"]
    assert agreed.get("human_decision_required") is not True
    assert agreed["verification"]["success"] is False
    assert agreed["verification"]["executed"] is True
    assert sm.current_stage == LaunchStage.THREE_PILOTS

    idle = cycle({"discovery": discovery}, state_machine=sm)
    assert idle["mode"] == "IDLE / MONITOR"
    assert "disagreement" not in idle["risks"]
    assert sm.current_stage == LaunchStage.THREE_PILOTS

    moved = brain.cycle(_advance_signal(decision_id="after-escalation"))
    assert moved["verification"]["success"] is True
    assert moved["economics"]["cash_realized"] is None
    assert sm.current_stage == LaunchStage.FIRST_REVENUE
    assert brain.execution_attempts == 1
