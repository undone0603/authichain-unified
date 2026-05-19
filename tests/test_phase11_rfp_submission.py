# tests/test_phase11_rfp_submission.py
import textwrap
import pytest
from pathlib import Path
import agentz.core.grants_pipeline as gp
from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import authichain_rfp_submission


def test_submission_loop_transitions_reviewed_to_submitted(tmp_path: Path, monkeypatch):
    ledger = tmp_path / "pipeline_ledger.json"
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    # 1. Pre-seed ledger with one 'drafted' and one 'reviewed' item
    gp.update_status("draft123", "drafted", ledger_path=ledger, title="Drafted Opp", artifact_path="x.md")
    gp.update_status("rev456", "reviewed", ledger_path=ledger, title="Reviewed Opp", artifact_path="y.md")

    # 2. Mock the browser submission to return success
    monkeypatch.setattr(
        "agentz.workflows.handlers.authichain_rfp_submission.submit_proposal_via_browser",
        lambda *args: _fake_async(True)
    )

    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test_submission", verbose=False)
    result = authichain_rfp_submission.run(ctx)

    # 3. Verify 'rev456' is now 'submitted'
    assert gp.status_of("rev456", ledger) == "submitted"
    # 'draft123' should still be 'drafted'
    assert gp.status_of("draft123", ledger) == "drafted"
    assert "1 submitted" in result


async def _fake_async(value):
    return value
