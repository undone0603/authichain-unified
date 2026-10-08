"""Right-Side Brain proposes testable options and does not commit them."""

from __future__ import annotations

import ast
import json

import pytest

from agentz.core.right_brain import (
    AUTHORITY_ACTIONS,
    CURIOSITY_FIELDS,
    FUTURE_FIELDS,
    FUTURES,
    HANDOFF_FIELDS,
    HUMAN_FACTORS,
    HYPOTHESIS_FIELDS,
    LAUNCH_BOTTLENECK,
    MEMORY_KINDS,
    OPERATORS,
    PRIMARY_METRIC,
    CreativeMemory,
    UntaggedClaim,
    propose,
    reject_untagged_claim,
    tagged_claim,
)

FORBIDDEN = (
    "customers feel",
    "customers love",
    "they believe",
    "the buyer wants",
    "market demand is",
    "people think",
)


def _launch():
    return json.loads(json.dumps(LAUNCH_BOTTLENECK))


def test_empty_signal_observes_and_proposes_nothing():
    for signal in (
        None,
        {},
        {"noise": "unread"},
        [],
        "noise",
        "   ",
        {"meaningful_opportunity": False, "problem": "still named"},
    ):
        result = propose(signal)
        assert result["mode"] == "OBSERVE / EXPLORE"
        assert result["proposals"] == []
        assert result["handoff"] is None
        assert result["futures"] == {}
        assert result["hypothesis"] is None
        assert result["exploration"] == []
        assert result["curiosity_queue"] == []
        assert result["narratives"] == []
        assert result["ledger_written"] is False
        assert result["metric"]["verified_value"] is None
        assert result["metric"]["cash"] is None
        assert result["human_context"]["customer_sentiment"] is None
        assert result["human_context"]["internal_thoughts"] is None


def test_bottleneck_uses_nine_distinct_operators():
    result = propose(_launch())
    assert result["mode"] == "PROPOSE"
    operators = [row["operator"] for row in result["proposals"]]
    assert operators == list(OPERATORS)
    assert operators == [
        "reframe",
        "reverse",
        "simplify",
        "combine",
        "remove",
        "substitute",
        "invert",
        "generalize",
        "specialize",
    ]
    failed = LAUNCH_BOTTLENECK["failed_method"]
    ideas = [row["idea"] for row in result["proposals"]]
    assert len(set(ideas)) == 9
    for row in result["proposals"]:
        assert row["idea"] != failed
        assert failed not in row["idea"]
        assert row["method"] == row["operator"]
        assert row["distinct_from_failed_method"] is True
        assert row["reframed"] is False
        assert row["testable"] is True
        assert row["operator"] in row["idea"]


def test_same_input_same_handoff_and_full_result():
    first = propose(_launch())
    second = propose(_launch())
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    assert set(first["handoff"]) == set(HANDOFF_FIELDS)
    confidence = first["handoff"]["confidence"]
    assert type(confidence) is float
    assert 0.0 <= confidence <= 1.0
    assert confidence == 0.25
    assert first["handoff"]["problem"] == LAUNCH_BOTTLENECK["problem"]
    assert first["handoff"]["why_now"] == LAUNCH_BOTTLENECK["why_now"]
    assert first["handoff"]["supporting_evidence"] == []
    assert first["handoff"]["idea"] == first["proposals"][0]["idea"]
    assert isinstance(first["handoff"]["expected_value"], str)
    assert "$" not in first["handoff"]["expected_value"]
    for action in AUTHORITY_ACTIONS:
        assert first["authority_denials"][action] == "denied"
    assert all(value == "denied" for value in first["authority_denials"].values())


def test_spend_request_stays_denied_and_evidence_is_only_copied():
    evidence = ["public page still names the internal offer"]
    signal = _launch()
    signal["evidence"] = evidence
    signal["authorize"] = "spend"
    signal["assumptions"] = ["caller assumption"]
    before = json.dumps(signal, sort_keys=True)
    result = propose(signal)
    assert json.dumps(signal, sort_keys=True) == before
    assert result["authority_denials"]["spend"] == "denied"
    assert result["handoff"]["supporting_evidence"] == evidence
    assert result["handoff"]["supporting_evidence"] is not evidence
    assert result["hypothesis"]["Evidence currently available"] == evidence
    assert result["hypothesis"]["Evidence currently available"] is not result["handoff"]["supporting_evidence"]
    assert "caller assumption" in result["handoff"]["assumptions"]
    assert result["handoff"]["confidence"] == 0.5
    assert set(result["hypothesis"]) == set(HYPOTHESIS_FIELDS)


def test_futures_hypothesis_exploration_and_curiosity():
    result = propose(_launch())
    assert list(result["futures"]) == list(FUTURES)
    opportunities = set()
    for name in FUTURES:
        future = result["futures"][name]
        assert set(future) == set(FUTURE_FIELDS)
        for field in FUTURE_FIELDS:
            assert isinstance(future[field], str) and future[field].strip()
            assert "TBD" not in future[field]
        opportunities.add(future["opportunity"])
        assert LAUNCH_BOTTLENECK["problem"] in future["opportunity"] or "Farm" in json.dumps(future)
    assert len(opportunities) == 5

    labels = [row["label"] for row in result["exploration"]]
    assert labels == [
        "WORTH INVESTIGATING",
        "UNKNOWN",
        "ASSUMED",
        "KNOWN",
        "NOT WORTH INVESTIGATING",
    ]
    values = [row["information_value"] for row in result["exploration"]]
    assert values == sorted(values, reverse=True)
    assert values == [0.85, 0.7, 0.45, 0.25, 0.05]
    assert labels != sorted(labels)

    queue = result["curiosity_queue"]
    assert queue
    info = [row["Information value"] for row in queue]
    assert info == sorted(info, reverse=True)
    assert info[0] > info[-1]
    for row in queue:
        assert set(row) == set(CURIOSITY_FIELDS)
        assert isinstance(row["Question"], str) and row["Question"].strip()


def test_narratives_are_labeled_and_do_not_invent_sentiment():
    result = propose(_launch())
    audiences = [row["audience"] for row in result["narratives"]]
    explanations = [row["explanation"] for row in result["narratives"]]
    assert audiences == ["technical", "business", "customer", "investor", "founder"]
    assert explanations == [
        "technical explanation",
        "business explanation",
        "customer explanation",
        "investor explanation",
        "founder-level strategic narrative",
    ]
    dumped = json.dumps(
        {
            "narratives": result["narratives"],
            "human_context": result["human_context"],
            "connections": result["connections"],
            "experience_question": result["experience_question"],
        }
    ).lower()
    for phrase in FORBIDDEN:
        assert phrase not in dumped
    for row in result["narratives"]:
        assert row["claims"]
        for claim in row["claims"]:
            reject_untagged_claim(claim)
            label = claim.split(":", 1)[0]
            assert label in {"demonstrated", "supported", "estimated", "aspirational"}
            assert claim.lower().count(label) == 1
    technical = result["narratives"][0]["claims"]
    assert not any(claim.startswith("demonstrated:") for claim in technical)
    for factor in HUMAN_FACTORS:
        assert result["human_context"][factor]["uncertainty"] == "explicit"
    assert result["human_context"]["customer_sentiment"] is None
    assert result["human_context"]["internal_thoughts"] is None
    assert all(row["status"] == "hypothesis" for row in result["connections"])


def test_priced_or_sentimental_bottleneck_still_hands_off():
    problems = (
        "The $299 DPP link is the bottleneck",
        "converts at 12%",
        "customers love the old checkout",
    )
    for problem in problems:
        result = propose(
            {
                "problem": problem,
                "failed_method": "retry the same Stripe list",
                "why_now": "The caller named this bottleneck",
                "meaningful_opportunity": True,
            }
        )
        assert result["mode"] == "PROPOSE"
        assert [row["operator"] for row in result["proposals"]] == list(OPERATORS)
        assert set(result["handoff"]) == set(HANDOFF_FIELDS)
        assert result["handoff"]["problem"] == problem
        supported = [
            claim
            for narrative in result["narratives"]
            for claim in narrative["claims"]
            if claim.startswith("supported:")
        ]
        assert supported
        for claim in supported:
            reject_untagged_claim(claim)
            assert problem.lower() not in claim.lower()
            assert "$" not in claim
            assert "%" not in claim
            for phrase in FORBIDDEN:
                assert phrase not in claim.lower()


def test_demonstrated_claim_requires_supplied_text():
    with pytest.raises(UntaggedClaim):
        reject_untagged_claim("the page is fine")
    with pytest.raises(UntaggedClaim):
        reject_untagged_claim("supported: customers love this record")
    with pytest.raises(UntaggedClaim):
        reject_untagged_claim("supported: estimated: two labels")
    with pytest.raises(UntaggedClaim):
        tagged_claim("demonstrated", "A page was read.", signal=None)

    shown = "The pricing page HTML contains the Farm checkout link."
    signal = _launch()
    signal["demonstrated"] = shown
    result = propose(signal)
    technical = " ".join(result["narratives"][0]["claims"])
    assert f"demonstrated: {shown}" in technical
    business = " ".join(result["narratives"][1]["claims"])
    assert "demonstrated:" not in business


def test_memory_round_trip_lesson_and_reframe():
    memory = CreativeMemory()
    for kind in MEMORY_KINDS:
        stored = memory.store(kind, f"sample {kind}")
        assert stored["organizational_fact"] is False
        stored["organizational_fact"] = True
        found = memory.lookup(kind)
        assert found[-1]["text"] == f"sample {kind}"
        assert found[-1]["organizational_fact"] is False
        assert found[-1]["kind"] == kind

    first = propose(_launch(), memory=memory)
    assert all(row["reframed"] is False for row in first["proposals"])
    failed_idea = first["proposals"][0]["idea"]
    assert memory.failure_count(failed_idea) == 0
    assert memory.record_failure(failed_idea) == 1
    assert memory.lookup("failed concepts")[-1]["text"] == failed_idea
    assert memory.lookup("failed concepts")[-1]["organizational_fact"] is False

    second = propose(_launch(), memory=memory)
    assert memory.failure_count(failed_idea) == 1
    assert all(row["idea"] != failed_idea for row in second["proposals"])
    reframed = [row for row in second["proposals"] if row["reframed"]]
    assert len(reframed) == 1
    assert reframed[0]["operator"] == "reframe"
    assert reframed[0]["idea"] != failed_idea
    assert failed_idea not in reframed[0]["idea"]
    assert second["handoff"]["idea"] == reframed[0]["idea"]

    lesson = memory.record_verified(
        {
            "verified": True,
            "previously_unknown": True,
            "value": 3,
            "lesson": "the read-only diff matched the caller wording",
        }
    )
    assert lesson["verified"] is True
    assert lesson["organizational_fact"] is False
    for kind in MEMORY_KINDS:
        for row in memory.lookup(kind):
            assert row["organizational_fact"] is False
    learned = propose(_launch(), memory=memory)
    assert learned["metric"]["name"] == PRIMARY_METRIC
    assert learned["metric"]["verified_value"] == 3
    assert learned["metric"]["cash"] is None
    assert learned["ledger_written"] is False


def test_primary_metric_is_not_idea_count_or_invented_cash():
    bare = propose(_launch())
    assert bare["metric"]["name"] == "verified value generated from previously unknown possibilities"
    assert bare["metric"]["verified_value"] is None
    assert bare["metric"]["cash"] is None
    assert bare["ledger_written"] is False
    assert bare["metric"]["name"] != "number of ideas generated"

    unnamed = propose(_launch(), verified_outcome={"value": 9})
    assert unnamed["metric"]["verified_value"] is None
    assert unnamed["metric"]["cash"] is None

    attributed = propose(
        _launch(),
        verified_outcome={"previously_unknown": True, "value": 3},
    )
    assert attributed["metric"]["verified_value"] == 3
    assert attributed["metric"]["cash"] is None

    cashed = propose(
        _launch(),
        verified_outcome={"previously_unknown": True, "value": 3, "cash": 3},
    )
    assert cashed["metric"]["cash"] == 3
    assert cashed["ledger_written"] is False

    idle = propose({})
    value = idle["metric"]["verified_value"]
    cash = idle["metric"]["cash"]
    assert value is None or not (isinstance(value, (int, float)) and value > 0)
    assert cash is None or not (isinstance(cash, (int, float)) and cash > 0)


def test_entry_imports_no_execution_side_effects():
    from agentz.core import right_brain

    tree = ast.parse(open(right_brain.__file__, encoding="utf-8").read())
    modules = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            modules.append((node.module or "").split(".")[0])
    assert {"requests", "stripe", "smtplib", "socket", "urllib", "subprocess"}.isdisjoint(modules)
    assert "auto_policy" not in modules
