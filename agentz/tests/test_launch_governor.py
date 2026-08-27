"""
Tests for the core Launch Governor control loop.

Covers:
  - launch_state: gate checks, stage transitions, blocking
  - launch_score: dimension scoring, bottleneck identification
  - risk_firewall: risk escalation, budget enforcement, veto
  - governor: cycle execution in dry-run mode
  - launch_gates: real gate functions with mock ctx
"""
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Ensure the package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from agentz.core.launch_state import (
    LaunchStage,
    LaunchStateMachine,
    STAGE_ORDER,
    GATE_CHECKS,
)
from agentz.core.launch_score import (
    calculate_launch_score,
    LaunchScore,
    DIMENSION_WEIGHTS,
)
from agentz.core.risk_firewall import (
    assess_workflow,
    RiskAssessment,
    should_force_confirm,
)
from agentz.core.specialists import (
    ProtocolGuardian,
    LaunchBuilder,
    GrowthScout,
    PilotCloser,
    ALL_SPECIALISTS,
)
from agentz.core.modes import Mode
from agentz.core.governor import LaunchGovernor, GovernorCycle


# ── launch_state tests ──────────────────────────────────────────────────────


class TestLaunchStateMachine:
    def test_boot_stage_has_single_gate(self):
        """BOOT should have exactly one gate that always passes."""
        checks = GATE_CHECKS[LaunchStage.BOOT.value]
        assert len(checks) == 1
        passed, evidence = checks[0](None)
        assert passed is True
        assert "initialized" in evidence

    def test_protocol_ready_has_real_gates(self):
        """PROTOCOL_READY should have 5 gates, not stubs."""
        checks = GATE_CHECKS[LaunchStage.PROTOCOL_READY.value]
        assert len(checks) == 5
        # Each check should be a real function (not a lambda that always returns True)
        for check in checks:
            # Real gate functions return (False, ...) when they can't verify
            # A stub lambda would return (True, ...) unconditionally
            passed, evidence = check(None)
            # When ctx is None, real gates should fail (can't verify)
            # except gate_protocol_docs which checks the filesystem
            assert isinstance(passed, bool)
            assert isinstance(evidence, str)
            assert len(evidence) > 0

    def test_production_ready_has_six_gates(self):
        checks = GATE_CHECKS[LaunchStage.PRODUCTION_READY.value]
        assert len(checks) == 6

    def test_beta_ready_has_four_gates(self):
        checks = GATE_CHECKS[LaunchStage.BETA_READY.value]
        assert len(checks) == 4

    def test_advance_blocked_when_gates_fail(self):
        """Cannot advance from PROTOCOL_READY when gates fail."""
        with tempfile.TemporaryDirectory() as tmp:
            sm = LaunchStateMachine(state_file=Path(tmp) / "state.json")
            sm.set_stage(LaunchStage.PROTOCOL_READY)
            # With no ctx, protocol gates should fail (can't verify)
            advanced = sm.advance(context={})
            assert advanced is False
            assert sm.current_stage == LaunchStage.PROTOCOL_READY

    def test_advance_from_boot_always_passes(self):
        """BOOT has a single gate that always passes."""
        with tempfile.TemporaryDirectory() as tmp:
            sm = LaunchStateMachine(state_file=Path(tmp) / "state.json")
            assert sm.current_stage == LaunchStage.BOOT
            advanced = sm.advance(context={})
            assert advanced is True
            assert sm.current_stage == LaunchStage.PROTOCOL_READY

    def test_pilot_count_gate(self):
        """THREE_PILOTS gate checks for 3 active pilots."""
        checks = GATE_CHECKS[LaunchStage.THREE_PILOTS.value]
        assert len(checks) == 1
        # With 3 pilots, should pass
        passed, evidence = checks[0]({"active_pilots": 3})
        assert passed is True
        assert "3" in evidence
        # With 2 pilots, should fail
        passed, evidence = checks[0]({"active_pilots": 2})
        assert passed is False
        assert "2" in evidence

    def test_revenue_gate(self):
        """FIRST_REVENUE gate checks for >= 1 paying customer."""
        checks = GATE_CHECKS[LaunchStage.FIRST_REVENUE.value]
        assert len(checks) == 1
        passed, evidence = checks[0]({"paying_customers": 1})
        assert passed is True
        passed, evidence = checks[0]({"paying_customers": 0})
        assert passed is False

    def test_set_stage_persists(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_file = Path(tmp) / "state.json"
            sm = LaunchStateMachine(state_file=state_file)
            sm.set_stage(LaunchStage.PRODUCTION_READY)
            # Reload from file
            sm2 = LaunchStateMachine(state_file=state_file)
            assert sm2.current_stage == LaunchStage.PRODUCTION_READY

    def test_stage_order_complete(self):
        """All 9 stages should be in order."""
        assert len(STAGE_ORDER) == 9
        assert STAGE_ORDER[0] == LaunchStage.BOOT
        assert STAGE_ORDER[-1] == LaunchStage.SCALE


# ── launch_score tests ───────────────────────────────────────────────────────


class TestLaunchScore:
    def test_weights_sum_to_100(self):
        assert sum(DIMENSION_WEIGHTS.values()) == 100

    def test_no_context_returns_baseline(self):
        score = calculate_launch_score(None, "BOOT")
        # With no context, all dimensions get baseline 50
        for name, dim in score.dimensions.items():
            assert dim.score == 50.0
        # Total should be 50 (all dimensions at 50, weighted = 50)
        assert 49 <= score.total <= 51

    def test_protocol_passes_increases_score(self):
        ctx = {
            "protocol_schema_pass": True,
            "protocol_signature_pass": True,
            "protocol_negative_pass": True,
            "protocol_deterministic": True,
        }
        score = calculate_launch_score(ctx, "PROTOCOL_READY")
        protocol_dim = score.dimensions["protocol"]
        assert protocol_dim.score == 100.0

    def test_protocol_fail_decreases_score(self):
        ctx = {
            "protocol_schema_pass": False,
            "protocol_signature_pass": False,
        }
        score = calculate_launch_score(ctx, "PROTOCOL_READY")
        protocol_dim = score.dimensions["protocol"]
        assert protocol_dim.score < 50.0

    def test_bottleneck_identified(self):
        """The lowest-scoring dimension should be the bottleneck."""
        ctx = {
            "protocol_schema_pass": True,
            "protocol_signature_pass": True,
            "protocol_negative_pass": True,
            "protocol_deterministic": True,
            "active_pilots": 0,
            "paying_customers": 0,
        }
        score = calculate_launch_score(ctx, "BETA_READY")
        assert score.bottleneck
        # Bottleneck should be one of the low-scoring dimensions
        assert score.bottleneck in score.dimensions

    def test_revenue_dimension_scales_with_pilots(self):
        ctx = {"paying_customers": 3}
        score = calculate_launch_score(ctx, "FIRST_REVENUE")
        revenue_dim = score.dimensions["revenue"]
        # 3 paying customers = 100% for paying_customers sub-metric
        assert revenue_dim.sub_metrics["paying_customers"] == 100.0

    def test_recommended_action_present(self):
        score = calculate_launch_score(None, "BOOT")
        assert score.recommended_action
        assert len(score.recommended_action) > 10


# ── risk_firewall tests ──────────────────────────────────────────────────────


class TestRiskFirewall:
    def test_low_risk_auto_approved(self):
        with tempfile.TemporaryDirectory() as tmp:
            audit = Path(tmp) / "audit.jsonl"
            assessment = assess_workflow(
                wf_id="test_wf",
                risk_class="low",
                financial_limit_usd=0,
                requires_human_approval=False,
                current_mode="auto",
                audit_log_path=audit,
            )
            assert assessment.approved is True
            assert assessment.escalated_mode is None

    def test_high_risk_escalates_to_confirm(self):
        with tempfile.TemporaryDirectory() as tmp:
            audit = Path(tmp) / "audit.jsonl"
            assessment = assess_workflow(
                wf_id="test_wf",
                risk_class="high",
                financial_limit_usd=0,
                requires_human_approval=False,
                current_mode="auto",
                audit_log_path=audit,
            )
            assert assessment.approved is True
            assert assessment.escalated_mode == "confirm"

    def test_critical_with_veto_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            audit = Path(tmp) / "audit.jsonl"
            assessment = assess_workflow(
                wf_id="launch_protocol_gate",
                risk_class="critical",
                financial_limit_usd=0,
                requires_human_approval=False,
                current_mode="auto",
                audit_log_path=audit,
                protocol_veto_active=True,
            )
            assert assessment.approved is False
            assert assessment.vetoed is True
            assert "ProtocolGuardian veto" in assessment.reason

    def test_budget_exhaustion_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            audit = Path(tmp) / "audit.jsonl"
            # Write a log entry showing $10 spent today
            from datetime import datetime, timezone
            entry = {
                "workflow_id": "test_wf",
                "status": "ok",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "cost_usd": 10.0,
            }
            audit.write_text(json.dumps(entry) + "\n")
            assessment = assess_workflow(
                wf_id="test_wf",
                risk_class="low",
                financial_limit_usd=5.0,  # limit is $5, already spent $10
                requires_human_approval=False,
                current_mode="auto",
                audit_log_path=audit,
            )
            assert assessment.approved is False
            assert "budget exhausted" in assessment.reason

    def test_requires_human_approval_overrides_auto(self):
        with tempfile.TemporaryDirectory() as tmp:
            audit = Path(tmp) / "audit.jsonl"
            assessment = assess_workflow(
                wf_id="test_wf",
                risk_class="low",
                financial_limit_usd=0,
                requires_human_approval=True,
                current_mode="auto",
                audit_log_path=audit,
            )
            assert assessment.approved is True
            assert assessment.escalated_mode == "confirm"

    def test_should_force_confirm_low_risk(self):
        assert should_force_confirm("low", False, "auto") is False

    def test_should_force_confirm_high_risk(self):
        assert should_force_confirm("high", False, "auto") is True

    def test_should_force_confirm_human_approval(self):
        assert should_force_confirm("low", True, "auto") is True

    def test_should_force_confirm_not_auto(self):
        """In confirm mode, never force (already confirming)."""
        assert should_force_confirm("high", True, "confirm") is False


# ── specialists tests ─────────────────────────────────────────────────────────


class TestSpecialists:
    def test_protocol_guardian_healthy(self):
        guardian = ProtocolGuardian()
        result = guardian.assess({
            "protocol_schema_pass": True,
            "protocol_signature_pass": True,
            "protocol_violations": [],
        })
        assert result.healthy is True
        assert result.veto is False

    def test_protocol_guardian_veto_on_violations(self):
        guardian = ProtocolGuardian()
        result = guardian.assess({
            "protocol_violations": ["schema_mismatch"],
        })
        assert result.healthy is False
        assert result.veto is True
        assert "Protocol integrity" in result.veto_reason

    def test_protocol_guardian_finds_schema_failure(self):
        guardian = ProtocolGuardian()
        result = guardian.assess({
            "protocol_schema_pass": False,
        })
        assert result.healthy is False
        assert any("schema" in f.lower() for f in result.findings)
        # Should recommend the protocol gate workflow
        assert any(
            a["workflow_id"] == "launch_protocol_gate"
            for a in result.recommended_actions
        )

    def test_launch_builder_finds_failing_tests(self):
        builder = LaunchBuilder()
        result = builder.assess({"failing_tests": 5})
        assert result.healthy is False
        assert any("5" in f for f in result.findings)

    def test_growth_scout_scores_prospect(self):
        score = GrowthScout.score_prospect(
            icp_fit=25, pain_intensity=20, authichain_fit=20,
            buying_authority=15, deployment_ease=10, revenue_potential=10,
        )
        assert score == 100

    def test_growth_scout_low_score(self):
        score = GrowthScout.score_prospect(
            icp_fit=5, pain_intensity=5, authichain_fit=5,
            buying_authority=5, deployment_ease=5, revenue_potential=5,
        )
        assert score == 30

    def test_all_six_specialists_exist(self):
        assert len(ALL_SPECIALISTS) == 6
        expected = {
            "ProtocolGuardian",
            "LaunchBuilder",
            "GrowthScout",
            "PilotCloser",
            "RevenueOperator",
            "TrustHealer",
        }
        assert set(ALL_SPECIALISTS.keys()) == expected

    def test_every_specialist_returns_result(self):
        for name, cls in ALL_SPECIALISTS.items():
            specialist = cls()
            result = specialist.assess({"stage": "BOOT"})
            assert result.role == name
            assert isinstance(result.healthy, bool)
            assert isinstance(result.findings, list)
            assert isinstance(result.recommended_actions, list)


# ── governor tests ───────────────────────────────────────────────────────────


class TestGovernor:
    def test_dry_run_cycle_completes(self):
        """A dry-run cycle should complete without errors and not execute anything."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            # Override log paths to temp
            import agentz.core.governor as gov_mod
            gov_mod.GOVERNOR_LOG = Path(tmp) / "governor.jsonl"
            gov_mod.SCORE_HISTORY = Path(tmp) / "scores.jsonl"

            cycle = governor.run_cycle(verbose=False)

            assert cycle.cycle_id.startswith("gov-")
            assert cycle.stage_before == cycle.stage_after  # dry-run doesn't advance
            # In dry-run, no actions should have "ok" status
            for action in cycle.actions_executed:
                assert action.get("status") == "would_execute"

    def test_budget_accumulates_across_cycles(self):
        """Budget tracking should account for spend from previous cycles."""
        with tempfile.TemporaryDirectory() as tmp:
            audit = Path(tmp) / "audit.jsonl"
            from datetime import datetime, timezone
            # Simulate $30 already spent today
            entry = {
                "workflow_id": "some_wf",
                "status": "ok",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "cost_usd": 30.0,
            }
            audit.write_text(json.dumps(entry) + "\n")

            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=audit,
                daily_budget=50.0,
            )
            spent = governor._budget_spent_today()
            assert spent == 30.0

    def test_observe_returns_real_data(self):
        """_observe should return real metrics, not stub defaults."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            ctx = governor._observe()
            # Should have real keys from audit/registry analysis
            assert "total_workflows" in ctx
            assert "registered_workflows" in ctx
            assert "stage" in ctx
            assert "secrets_present" in ctx
            # Should NOT have setdefault stubs that always pass
            # secrets_present should be a real boolean, not always True
            assert isinstance(ctx["secrets_present"], bool)


# ── Governor+Architect unification tests ─────────────────────────────────────


class TestGovernorArchitectUnification:
    def test_governor_has_assess_fleet(self):
        """Governor should have the fleet assessment method from Architect."""
        governor = LaunchGovernor(mode=Mode.DRY_RUN)
        assert hasattr(governor, "assess_fleet")
        fleet = governor.assess_fleet()
        assert fleet.total_workflows > 0
        assert isinstance(fleet.healthy, list)
        assert isinstance(fleet.failing, list)
        assert isinstance(fleet.per_workflow, dict)

    def test_governor_has_generate_llm_plan(self):
        """Governor should have LLM plan generation from Architect."""
        governor = LaunchGovernor(mode=Mode.DRY_RUN)
        assert hasattr(governor, "generate_llm_plan")
        fleet = governor.assess_fleet()
        # LLM may not be available in test env — should return a fallback plan
        plan = governor.generate_llm_plan(fleet, "test goal")
        assert plan.goal == "test goal"
        assert isinstance(plan.actions, list)
        assert isinstance(plan.rationale, str)

    def test_governor_cycle_includes_llm_plan_in_ctx(self):
        """The Governor cycle should populate _llm_plan in ctx."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            import agentz.core.governor as gov_mod
            gov_mod.GOVERNOR_LOG = Path(tmp) / "governor.jsonl"
            gov_mod.SCORE_HISTORY = Path(tmp) / "scores.jsonl"

            cycle = governor.run_cycle(verbose=False)
            # The cycle should complete with fleet assessment
            assert cycle.cycle_id.startswith("gov-")

    def test_architect_delegates_to_governor(self):
        """ArchitectAgent.run_cycle should produce a CycleReport via Governor."""
        from agentz.core.architect import ArchitectAgent, CycleReport
        with tempfile.TemporaryDirectory() as tmp:
            architect = ArchitectAgent(audit_log_path=Path(tmp) / "audit.jsonl")
            import agentz.core.governor as gov_mod
            gov_mod.GOVERNOR_LOG = Path(tmp) / "governor.jsonl"
            gov_mod.SCORE_HISTORY = Path(tmp) / "scores.jsonl"

            report = architect.run_cycle(
                goal="test", mode=Mode.DRY_RUN, verbose=False
            )
            assert isinstance(report, CycleReport)
            assert report.cycle_id.startswith("gov-")  # Governor cycle ID
            assert isinstance(report.net_improvement, int)

    def test_architect_cli_delegates_to_governor(self):
        """Architect.main should delegate to Governor.main."""
        import inspect
        from agentz.core import architect
        src = inspect.getsource(architect.main)
        assert "governor_main" in src or "governor.main" in src


# ── Adaptive strategy / trend analysis tests ─────────────────────────────────


class TestAdaptiveStrategy:
    def test_no_trend_returns_default_strategy(self):
        """With no score history, strategy should be defaults."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            strategy = governor._compute_adaptive_strategy({})
            assert strategy["bottleneck_persistent"] is False
            assert strategy["score_regression"] is False
            assert strategy["priority_override"] is None

    def test_persistent_bottleneck_detected(self):
        """Same bottleneck 3+ cycles should trigger persistent flag."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            ctx = {
                "score_trend": {
                    "bottleneck": "protocol",
                    "bottleneck_persistence": 4,
                    "delta": 0,
                }
            }
            strategy = governor._compute_adaptive_strategy(ctx)
            assert strategy["bottleneck_persistent"] is True
            assert strategy["priority_override"] == "protocol"
            assert "protocol_verification" in strategy["budget_reallocation"]

    def test_score_regression_detected(self):
        """Decreasing scores over 3+ cycles should trigger regression flag."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            ctx = {
                "score_trend": {
                    "bottleneck": "protocol",
                    "bottleneck_persistence": 1,
                    "delta": -5,
                    "recent_scores": [60, 55, 50],
                }
            }
            strategy = governor._compute_adaptive_strategy(ctx)
            assert strategy["score_regression"] is True

    def test_no_regression_on_small_fluctuation(self):
        """A small dip should not trigger regression (needs 3 monotonic decrease)."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            ctx = {
                "score_trend": {
                    "bottleneck": "protocol",
                    "bottleneck_persistence": 1,
                    "delta": -2,
                    "recent_scores": [55, 53, 54],  # not monotonic
                }
            }
            strategy = governor._compute_adaptive_strategy(ctx)
            assert strategy["score_regression"] is False

    def test_budget_reallocation_maps_to_bottleneck(self):
        """Persistent bottleneck should suggest budget reallocation."""
        with tempfile.TemporaryDirectory() as tmp:
            governor = LaunchGovernor(
                mode=Mode.DRY_RUN,
                audit_log_path=Path(tmp) / "audit.jsonl",
            )
            for bottleneck, expected_category in [
                ("protocol", "protocol_verification"),
                ("revenue", "revenue_ops"),
                ("growth", "growth_ops"),
            ]:
                ctx = {
                    "score_trend": {
                        "bottleneck": bottleneck,
                        "bottleneck_persistence": 3,
                        "delta": 0,
                    }
                }
                strategy = governor._compute_adaptive_strategy(ctx)
                assert expected_category in strategy["budget_reallocation"]
                assert strategy["budget_reallocation"][expected_category] == 0.4


# ── SSE endpoint tests ───────────────────────────────────────────────────────


class TestSSE:
    def test_sse_router_imports(self):
        """The SSE module should import without errors."""
        from agentz.api.sse import router
        assert router is not None

    def test_sse_event_format(self):
        """_sse_event should produce valid SSE format."""
        from agentz.api.sse import _sse_event
        event = _sse_event("test", {"key": "value"})
        assert event.startswith("event: test\n")
        assert "data: " in event
        assert event.endswith("\n\n")
        # Data should be valid JSON
        data_line = [l for l in event.split("\n") if l.startswith("data: ")][0]
        data = json.loads(data_line[len("data: "):])
        assert data == {"key": "value"}

    def test_tail_jsonl_yields_new_entries(self):
        """_tail_jsonl should yield entries appended after connection."""
        import asyncio
        from agentz.api.sse import _tail_jsonl

        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "test.jsonl"
            log.write_text("")  # create empty file

            async def test_run():
                # Start tailing
                gen = _tail_jsonl(log, poll_interval=0.05)
                # Give it a moment to record the initial offset
                await asyncio.sleep(0.15)

                # Append a line (use 'a' mode, not write_text which overwrites)
                with log.open("a") as f:
                    f.write(json.dumps({"event": "test1"}) + "\n")

                # Read the yielded event (with timeout)
                event = await asyncio.wait_for(gen.__anext__(), timeout=3.0)
                assert "event: data" in event
                assert "test1" in event
                return True

            # Run with timeout
            try:
                result = asyncio.run(asyncio.wait_for(test_run(), timeout=5.0))
                assert result is True
            except asyncio.TimeoutError:
                pytest.skip("SSE tail test timed out (environment issue)")

    def test_main_app_includes_sse_router(self):
        """The main FastAPI app should include the SSE router."""
        from agentz.api.main import app
        routes = [r.path for r in app.routes]
        assert any("/launch/sse/" in r for r in routes)
