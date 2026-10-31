from agentz.core.si_adaptation import (
    AdaptationMemory,
    AdaptationOutcome,
    choose_next_action,
    evaluate_adaptation,
    rank_candidates,
)


def test_unseen_actions_explore_deterministically():
    memory = AdaptationMemory()
    ranked = rank_candidates(
        [
            {"action_id": "b", "estimated_gain": 2.0, "confidence": 0.8},
            {"action_id": "a", "estimated_gain": 2.0, "confidence": 0.8},
        ],
        memory,
    )
    assert [item.action_id for item in ranked] == ["a", "b"]
    assert ranked[0].exploration_bonus > 0


def test_measured_winner_is_preferred_over_unproven_equal_prior():
    memory = AdaptationMemory()
    memory.observe(
        AdaptationOutcome(
            action_id="proven",
            baseline_score=50.0,
            outcome_score=60.0,
            cost_usd=0.0,
            latency_s=1.0,
            risk=0.0,
            success=True,
        )
    )
    ranked = rank_candidates(
        [
            {"action_id": "proven", "estimated_gain": 1.0, "confidence": 0.5},
            {"action_id": "new", "estimated_gain": 1.0, "confidence": 0.5},
        ],
        memory,
    )
    assert ranked[0].action_id == "proven"


def test_cost_latency_and_risk_can_overturn_raw_gain():
    memory = AdaptationMemory()
    ranked = rank_candidates(
        [
            {
                "action_id": "fast-safe",
                "estimated_gain": 4.0,
                "confidence": 0.8,
                "cost_usd": 0.0,
                "latency_s": 1.0,
                "risk": 0.0,
            },
            {
                "action_id": "risky-expensive",
                "estimated_gain": 5.0,
                "confidence": 0.2,
                "cost_usd": 100.0,
                "latency_s": 60.0,
                "risk": 0.9,
            },
        ],
        memory,
    )
    assert ranked[0].action_id == "fast-safe"


def test_memory_is_serializable_and_updates_incrementally():
    memory = AdaptationMemory()
    memory.observe(
        AdaptationOutcome(
            action_id="x",
            baseline_score=10,
            outcome_score=12,
            success=True,
        )
    )
    memory.observe(
        AdaptationOutcome(
            action_id="x",
            baseline_score=12,
            outcome_score=11,
            success=False,
        )
    )
    profile = memory.profile("x")
    assert profile.trials == 2
    assert profile.successes == 1
    assert profile.mean_delta == 0.5
    assert memory.snapshot()["x"]["trials"] == 2


def test_evaluate_adaptation_marks_regression_as_unsuccessful():
    outcome = evaluate_adaptation(
        80.0,
        75.0,
        cost_usd=1.0,
        latency_s=2.0,
        risk=0.4,
    )
    assert outcome.delta == -5.0
    assert outcome.success is False


def test_choose_next_action_returns_none_for_empty_candidates():
    assert choose_next_action([], AdaptationMemory()) is None
