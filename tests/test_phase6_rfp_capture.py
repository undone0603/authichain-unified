# tests/test_phase6_rfp_capture.py
import textwrap
from pathlib import Path
import agentz.core.grants_pipeline as gp
from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import authichain_rfp_capture


def test_dry_run_loops_all_qualified(tmp_path: Path, monkeypatch, capsys):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            a,Alpha,DOD,2099-01-01T00:00:00-04:00,90
            b,Bravo,NIH,2099-01-01T00:00:00-04:00,85
            c,LowScore,DOD,2099-01-01T00:00:00-04:00,40
            """
        ),
        encoding="utf-8",
    )
    ledger = tmp_path / "pipeline_ledger.json"

    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="test_rfp_capture")
    result = authichain_rfp_capture.run(ctx)

    out = capsys.readouterr().out
    # Both qualified opportunities should be announced; the low-score one must not
    assert "Alpha" in out
    assert "Bravo" in out
    assert "LowScore" not in out
    # Dry-run must NOT write the ledger (no side-effects)
    assert not ledger.exists()
    # Returned summary should mention the count
    assert "2" in result


def test_skips_already_drafted(tmp_path: Path, monkeypatch):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            a,Alpha,DOD,2099-01-01T00:00:00-04:00,90
            b,Bravo,NIH,2099-01-01T00:00:00-04:00,85
            """
        ),
        encoding="utf-8",
    )
    ledger = tmp_path / "pipeline_ledger.json"
    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    # Pre-seed: 'a' is already drafted
    gp.update_status("a", "drafted", ledger_path=ledger, title="Alpha", agency="DOD")

    # Avoid LLM and disk writes in AUTO mode
    monkeypatch.setattr(
        "agentz.workflows.handlers.authichain_rfp_capture.draft_federal_proposal",
        lambda grant: _fake_async("# draft for " + grant["notice_id"]),
    )
    monkeypatch.setattr(
        "agentz.core.grants.save_proposal",
        lambda name, content: str(tmp_path / f"{name}.md"),
    )

    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test_rfp_capture", verbose=False)
    authichain_rfp_capture.run(ctx)

    data = gp.read_ledger(ledger)
    # 'a' was preserved; 'b' is newly drafted
    assert data["a"]["status"] == "drafted"
    assert data["b"]["status"] == "drafted"
    # 'b' should have exactly one history entry, 'a' should still have exactly one
    assert len(data["a"]["history"]) == 1
    assert len(data["b"]["history"]) == 1


async def _fake_async(value):
    return value


def test_govchain_proposal_uses_pipeline_and_writes_ledger(tmp_path: Path, monkeypatch):
    from agentz.workflows.handlers import govchain_proposal
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            top,Top Opp,DOD,2099-01-01T00:00:00-04:00,95
            also,Other,NIH,2099-01-01T00:00:00-04:00,85
            """
        ),
        encoding="utf-8",
    )
    ledger = tmp_path / "pipeline_ledger.json"
    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    # Stub out the LLM and the disk write inside govchain_proposal
    class _FakeLLM:
        def invoke(self, prompt):
            class R: content = "# stub proposal"
            return R()
    monkeypatch.setattr("agentz.workflows.handlers.govchain_proposal.get_llm", lambda **kw: _FakeLLM())

    proposals_dir = tmp_path / "content_grants"
    monkeypatch.setattr(
        "agentz.workflows.handlers.govchain_proposal.PROPOSALS_DIR",
        proposals_dir,
    )

    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test_govchain", verbose=False)
    out = govchain_proposal.run(ctx)

    # Highest fit_score 'top' should have been picked
    assert "top" in out
    assert gp.status_of("top", ledger) == "drafted"
    # 'also' was not picked this run
    assert gp.status_of("also", ledger) is None
    # Drafted file exists in patched dir
    assert (proposals_dir / "top.md").exists()
