"""
Regression test for agentz.workflows.handlers.sam_gov_dhs.

Prior bug: this workflow's registry entry sets confirm_before_run: true
(agentz/workflows/registry.yaml:893) specifically so that even a full
`--mode auto` run downgrades it to Mode.CONFIRM (see
agentz.core.runner.py:145's `effective_mode` logic) before it ever
autonomously submits a real $200,000 federal grant application. But the
handler's own run() only special-cased Mode.DRY_RUN -- for Mode.CONFIRM it
fell straight through to the real browser-automation submission with no
interactive prompt at all, silently defeating the one safety gate this
workflow was specifically configured to have. (Contrast with the sibling
agentz/workflows/handlers/authichain_rfp_submission.py, which correctly
wraps its own real-portal submission in ctx.step(), the mechanism that
actually implements the "Proceed? [y/N]" prompt in Mode.CONFIRM.)
"""
from __future__ import annotations

from unittest.mock import patch

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import sam_gov_dhs


def make_ctx(mode: Mode) -> ExecutionContext:
    return ExecutionContext(mode=mode, workflow_id="test-sam-gov-dhs", verbose=False)


@patch("agentz.workflows.handlers.sam_gov_dhs.get_or_placeholder", return_value="fake-session")
@patch("agentz.workflows.handlers.sam_gov_dhs._run_browser_task")
def test_confirm_mode_does_not_submit_without_an_explicit_yes(mock_browser_task, mock_get):
    with patch("builtins.input", return_value="n"):
        sam_gov_dhs.run(make_ctx(Mode.CONFIRM))

    mock_browser_task.assert_not_called()


@patch("agentz.workflows.handlers.sam_gov_dhs.get_or_placeholder", return_value="fake-session")
@patch("agentz.workflows.handlers.sam_gov_dhs._run_browser_task")
def test_confirm_mode_submits_only_after_an_explicit_yes(mock_browser_task, mock_get):
    mock_browser_task.return_value = "SAM.gov / DHS Submission complete. Confirmation: TEST123"

    with patch("builtins.input", return_value="y"):
        sam_gov_dhs.run(make_ctx(Mode.CONFIRM))

    mock_browser_task.assert_called_once()


@patch("agentz.workflows.handlers.sam_gov_dhs.get_or_placeholder", return_value="fake-session")
@patch("agentz.workflows.handlers.sam_gov_dhs._run_browser_task")
def test_dry_run_never_touches_the_real_browser_task(mock_browser_task, mock_get):
    result = sam_gov_dhs.run(make_ctx(Mode.DRY_RUN))

    mock_browser_task.assert_not_called()
    assert "dry-run" in result.lower()


@patch("agentz.workflows.handlers.sam_gov_dhs.get_or_placeholder", return_value="fake-session")
@patch("agentz.workflows.handlers.sam_gov_dhs._run_browser_task")
def test_auto_mode_is_refused_regardless_of_which_runner_invoked_it(mock_browser_task, mock_get):
    # Two separate runners exist in this codebase (agentz/core/runner.py and
    # agentz/workflows/runner.py). Only the former applies the registry's
    # confirm_before_run -> effective_mode promotion; the latter -- the one
    # actually wired into GitHub Actions for other handlers, and the
    # established pattern anyone would copy to wire this one up too --
    # defaults straight to Mode.AUTO with no promotion at all. This handler
    # must not trust that some *other* layer will have already downgraded
    # AUTO to CONFIRM before calling it.
    result = sam_gov_dhs.run(make_ctx(Mode.AUTO))

    mock_browser_task.assert_not_called()
    assert "refused" in result.lower()
    assert "auto" in result.lower()
