"""The consequence gate self-test workflow passes 6/6 and touches nothing real."""

from __future__ import annotations

import json

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import consequence_gate_selftest


def test_selftest_passes_in_dry_run(tmp_path, monkeypatch):
    monkeypatch.setattr("agentz.core.modes.CHECKPOINT_DIR", tmp_path)
    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="consequence_gate_selftest", verbose=False)
    summary = json.loads(consequence_gate_selftest.run(ctx))
    assert summary["passed"] == "6/6"
    assert summary["rollback_intact"] is True


def test_selftest_scenarios_stay_in_temp_dir(tmp_path):
    results = consequence_gate_selftest.scenarios(tmp_path)
    assert all(r["ok"] for r in results), results
    assert sorted(p.name for p in tmp_path.iterdir()) == ["ws"]
