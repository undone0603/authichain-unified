"""Tests for agentz.core.autoloop (ordering, safety defaults, retries, ledger)."""

import pytest

from agentz.core import autoloop as al
from agentz.core import autonomy_policy as ap


@pytest.fixture(autouse=True)
def isolated_state(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENTZ_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("AGENTZ_KILL_FILE", str(tmp_path / "KILL"))
    monkeypatch.delenv("AGENTZ_KILL_SWITCH", raising=False)
    monkeypatch.chdir(tmp_path)


def E(wid, **kw):
    entry = {"id": wid, "handler": "handlers." + wid, "priority": "medium"}
    entry.update(kw)
    return entry


def pols(*entries):
    entries = list(entries)
    return [ap.policy_for(e["id"], entries) for e in entries]


def ids(policies):
    return [p.workflow_id for p in policies]


class Script:
    """run_one stand-in: returns scripted exit codes per workflow id."""

    def __init__(self, codes=None):
        self.codes = codes or {}
        self.calls = []

    def __call__(self, policy, mode):
        self.calls.append((policy.workflow_id, mode))
        seq = self.codes.get(policy.workflow_id, [0])
        n = sum(1 for c in self.calls if c[0] == policy.workflow_id)
        return seq[min(n, len(seq)) - 1]


def test_plan_orders_by_priority_then_dependencies():
    p = pols(
        E("low_a", priority="low"),
        E("crit_b", priority="critical", prerequisites=["low_a"]),
        E("high_c", priority="high"),
        E("crit_d", priority="critical"),
    )
    order, skipped = al.plan(p)
    assert ids(order) == ["crit_d", "high_c", "low_a", "crit_b"] and skipped == []


def test_blocks_revenue_breaks_priority_ties():
    p = pols(E("first"), E("second", blocks_revenue=True))
    assert ids(al.plan(p)[0]) == ["second", "first"]


def test_selection_pulls_prerequisites_unless_disabled():
    p = pols(E("a"), E("b", prerequisites=["a"]), E("c"))
    assert ids(al.plan(p, ["b"])[0]) == ["a", "b"]
    assert ids(al.plan(p, ["b"], include_prerequisites=False)[0]) == ["b"]


def test_unknown_selection_is_reported_not_run():
    order, skipped = al.plan(pols(E("a")), ["a", "ghost"])
    assert ids(order) == ["a"] and skipped == [("ghost", "unknown workflow")]


def test_risk_above_ceiling_is_skipped_with_its_dependents():
    p = pols(E("risky", risk_class="high"), E("child", prerequisites=["risky"]), E("fine"))
    order, skipped = al.plan(p)
    assert ids(order) == ["fine"]
    reasons = dict(skipped)
    assert "exceeds max-risk" in reasons["risky"] and "not runnable" in reasons["child"]
    assert set(ids(al.plan(p, max_risk="high")[0])) == {"risky", "child", "fine"}


def test_outbound_workflows_are_excluded_from_run_all_but_not_explicit_picks():
    p = pols(E("send_outreach"), E("plain"), E("needs_send", prerequisites=["send_outreach"]))
    order, skipped = al.plan(p)
    assert ids(order) == ["plain"]
    assert dict(skipped)["send_outreach"].startswith("excluded")
    assert "not runnable" in dict(skipped)["needs_send"]
    assert ids(al.plan(p, ["send_outreach"])[0]) == ["send_outreach"]


def test_dependency_cycle_and_unresolved_prerequisite_are_skipped():
    p = pols(E("a", prerequisites=["b"]), E("b", prerequisites=["a"]), E("c", prerequisites=["nope"]), E("d"))
    order, skipped = al.plan(p)
    reasons = dict(skipped)
    assert ids(order) == ["d"]
    assert reasons["a"] == "dependency cycle" and reasons["b"] == "dependency cycle"
    assert "unresolved prerequisite" in reasons["c"]


def test_real_registry_plan_is_consistent():
    pytest.importorskip("yaml")
    entries = ap.load_registry()
    policies = [ap.policy_for(e["id"], entries) for e in entries]
    order, skipped = al.plan(policies)
    seen = set()
    for pol in order:
        assert all(d in seen for d in pol.prerequisites if d in {p.workflow_id for p in order}), pol.workflow_id
        seen.add(pol.workflow_id)
    assert not [w for w, r in skipped if r == "dependency cycle"]
    assert not [p.workflow_id for p in order if any(x in p.workflow_id for x in al.DEFAULT_EXCLUDE)]


def test_auto_mode_needs_explicit_opt_in():
    p = pols(E("a"))
    with pytest.raises(al.AutoModeNotAllowed):
        al.run_loop(p, mode="auto", selected=["a"], run_one=Script())
    with pytest.raises(al.AutoModeNotAllowed):
        al.run_loop(p, mode="auto", allow_auto=True, run_one=Script())
    with pytest.raises(ValueError):
        al.run_loop(p, mode="confirm", run_one=Script())
    run = Script()
    report = al.run_loop(p, mode="auto", selected=["a"], allow_auto=True, run_one=run)
    assert report.exit_code == 0 and run.calls == [("a", "auto")]


def test_default_mode_is_dry_run_and_steps_run_in_order():
    run = Script()
    report = al.run_loop(pols(E("a"), E("b", prerequisites=["a"])), run_one=run)
    assert run.calls == [("a", "dry-run"), ("b", "dry-run")]
    assert [s.status for s in report.steps] == ["ok", "ok"] and report.exit_code == 0


def test_failed_prerequisite_skips_dependents():
    run = Script({"a": [1]})
    report = al.run_loop(pols(E("a"), E("b", prerequisites=["a"]), E("c")), run_one=run, sleep=lambda s: None)
    status = {s.workflow_id: s for s in report.steps}
    assert status["a"].status == "failed" and status["c"].status == "ok"
    assert status["b"].status == "skipped" and "prerequisite a" in status["b"].reason
    assert report.exit_code == 1 and ("b", "dry-run") not in run.calls


def test_retries_use_exponential_backoff_capped_by_max_delay():
    sleeps = []
    run = Script({"a": [1, 1, 0]})
    report = al.run_loop(pols(E("a", max_attempts=3)), run_one=run, sleep=sleeps.append, base_delay=2.0)
    assert report.steps[0].status == "ok" and report.steps[0].attempts == 3 and sleeps == [2.0, 4.0]
    sleeps.clear()
    al.run_loop(pols(E("a", max_attempts=3)), run_one=Script({"a": [1, 1, 1]}), sleep=sleeps.append, base_delay=100, max_delay=5)
    assert sleeps == [5, 5]


@pytest.mark.parametrize("code,status", [(11, "awaiting_approval"), (12, "verify_failed"), (124, "failed")])
def test_side_effect_risky_exits_are_never_retried(code, status):
    run = Script({"a": [code]})
    report = al.run_loop(pols(E("a", max_attempts=4), E("b", prerequisites=["a"])), run_one=run, sleep=lambda s: None)
    assert report.steps[0].status == status and report.steps[0].attempts == 1
    assert run.calls == [("a", "dry-run")]


def test_kill_switch_before_start_halts_everything():
    ap.engage_kill_switch("test")
    run = Script()
    report = al.run_loop(pols(E("a"), E("b")), run_one=run)
    assert run.calls == [] and report.halted and report.exit_code == al.EXIT_KILLED
    assert {s.status for s in report.steps} == {"halted"}


def test_kill_switch_mid_run_stops_the_remaining_steps():
    calls = []

    def run_one(policy, mode):
        calls.append(policy.workflow_id)
        ap.engage_kill_switch("mid-run")
        return 0

    report = al.run_loop(pols(E("a", priority="high"), E("b")), run_one=run_one)
    assert calls == ["a"]
    assert [s.status for s in report.steps] == ["ok", "halted"] and report.exit_code == al.EXIT_KILLED


def test_policy_unavailable_halts_the_loop_with_its_own_code():
    run = Script({"a": [13]})
    report = al.run_loop(pols(E("a", priority="high"), E("b")), run_one=run)
    assert report.halted and report.exit_code == al.EXIT_POLICY and run.calls == [("a", "dry-run")]


def test_max_steps_budget_bounds_an_unattended_run():
    run = Script()
    report = al.run_loop(pols(E("a"), E("b"), E("c")), run_one=run, max_steps=2)
    assert len(run.calls) == 2
    assert sorted(s.status for s in report.steps) == ["ok", "ok", "skipped"]


def test_awaiting_approval_sets_exit_11_when_nothing_failed():
    report = al.run_loop(pols(E("a")), run_one=Script({"a": [11]}))
    assert report.exit_code == al.EXIT_APPROVAL


def test_ledger_records_the_run_and_ignores_torn_lines():
    al.run_loop(pols(E("a")), run_one=Script())
    with al.ledger_path().open("a") as fh:
        fh.write('{"event": "step", "workflow_')  # torn write
    events = al.read_ledger()
    assert [e["event"] for e in events] == ["run_start", "step", "run_end"]
    assert events[1]["workflow_id"] == "a" and events[2]["exit_code"] == 0
