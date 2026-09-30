"""AGENTZ_PLAN_TIMEOUT bounds the architect plan call; past it the governor falls back."""

import time

import pytest

from agentz.core.llm import PlanTimeout, invoke_within, plan_budget_seconds


@pytest.mark.parametrize(
    "raw, expected",
    [
        (None, 80.0),
        ("30", 30.0),
        ("2", 5.0),
        ("900", 300.0),
        ("not-a-number", 80.0),
    ],
)
def test_plan_budget(monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv("AGENTZ_PLAN_TIMEOUT", raising=False)
    else:
        monkeypatch.setenv("AGENTZ_PLAN_TIMEOUT", raw)
    assert plan_budget_seconds() == expected


class _SlowLLM:
    """Outlives any budget it is given, so the timeout path is the one taken."""

    def invoke(self, messages):
        time.sleep(0.4)
        return '{"actions": []}'


def test_invoke_within_raises_past_the_budget():
    start = time.monotonic()
    with pytest.raises(PlanTimeout):
        invoke_within(_SlowLLM(), [], 0.1)
    assert time.monotonic() - start < 0.35


def test_governor_falls_back_when_the_plan_call_times_out(monkeypatch):
    from agentz.core.governor import FleetState, LaunchGovernor

    # plan_budget_seconds clamps to a 5s floor, so the budget is patched
    # directly rather than through AGENTZ_PLAN_TIMEOUT.
    monkeypatch.setattr("agentz.core.llm.get_llm", lambda: _SlowLLM())
    monkeypatch.setattr("agentz.core.llm.plan_budget_seconds", lambda: 0.1)

    governor = LaunchGovernor()
    start = time.monotonic()
    plan = governor.generate_llm_plan(FleetState(), "test timeout goal")
    duration = time.monotonic() - start

    assert plan.goal == "test timeout goal"
    assert plan.actions == []
    assert "LLM unavailable" in plan.rationale
    assert duration < 0.35
