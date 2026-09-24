"""AGENTZ_PLAN_TIMEOUT bounds an architect/governor plan call; a hung model yields the no-LLM plan."""

import time

import pytest

import agentz.core.llm as llm_mod
from agentz.core.modes import Mode


class _SlowLLM:
    def __init__(self, delay: float):
        self.delay = delay

    def invoke(self, messages, *args, **kwargs):
        time.sleep(self.delay)
        return type("R", (), {"content": '{"actions": [{"workflow_id": "late"}]}'})()


@pytest.mark.parametrize(
    "raw, expected",
    [
        (None, 80.0),
        ("60", 60.0),
        ("1", 5.0),
        ("9999", 300.0),
        ("soon", 80.0),
    ],
)
def test_plan_budget_seconds(monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv("AGENTZ_PLAN_TIMEOUT", raising=False)
    else:
        monkeypatch.setenv("AGENTZ_PLAN_TIMEOUT", raw)
    assert llm_mod.plan_budget_seconds() == expected


def test_invoke_within_returns_a_fast_answer():
    res = llm_mod.invoke_within(_SlowLLM(0), ["hi"], 2)
    assert "late" in res.content


def test_invoke_within_gives_up_at_the_budget():
    started = time.monotonic()
    with pytest.raises(llm_mod.PlanTimeout):
        llm_mod.invoke_within(_SlowLLM(3), ["hi"], 0.2)
    assert time.monotonic() - started < 1.5


def test_governor_falls_back_when_the_model_hangs(monkeypatch):
    from agentz.core.governor import LaunchGovernor

    monkeypatch.setattr(llm_mod, "get_llm", lambda *a, **k: _SlowLLM(3))
    monkeypatch.setattr(llm_mod, "plan_budget_seconds", lambda: 0.2)
    governor = LaunchGovernor(mode=Mode.DRY_RUN)
    fleet = governor.assess_fleet()
    started = time.monotonic()
    plan = governor.generate_llm_plan(fleet, "smoke")
    assert time.monotonic() - started < 1.5
    assert plan.actions == []
    assert "exceeded" in plan.rationale


def test_architect_falls_back_to_the_deterministic_plan(monkeypatch):
    from agentz.core.architect import ArchitectAgent

    monkeypatch.setattr(llm_mod, "plan_budget_seconds", lambda: 0.2)
    architect = ArchitectAgent()
    architect._llm = _SlowLLM(3)
    fleet = architect.assess_fleet()
    started = time.monotonic()
    plan = architect.generate_plan(fleet, "smoke")
    assert time.monotonic() - started < 1.5
    assert plan.rationale.startswith("Deterministic fallback")
