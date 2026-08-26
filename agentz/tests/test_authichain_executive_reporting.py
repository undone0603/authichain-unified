"""
Regression test for agentz.workflows.handlers.authichain_executive_reporting.

Prior bug: the Merchant ROI Report for a real, named CRM deal always used
hardcoded metrics (1500 scans, 8500 rewards, 28% retention) regardless of
whether that merchant had any real usage at all -- a comment falsely
claimed these were "estimate[d] based on deal size," but no such estimation
happened. A prospect with zero real product usage would get a report that
reads like a live customer's real performance data.
"""
from __future__ import annotations

from unittest.mock import patch, AsyncMock

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import authichain_executive_reporting as handler


def make_ctx() -> ExecutionContext:
    return ExecutionContext(mode=Mode.AUTO, workflow_id="test-exec-reporting", verbose=False)


@patch.object(handler.lm_manager, "unload_model")
@patch.object(handler.lm_manager, "load_model")
@patch("agentz.workflows.handlers.authichain_executive_reporting.save_report", return_value="/tmp/fake_report.md")
@patch("agentz.workflows.handlers.authichain_executive_reporting.generate_merchant_roi_report", new_callable=AsyncMock)
@patch("agentz.workflows.handlers.authichain_executive_reporting.generate_municipal_proposal", new_callable=AsyncMock)
@patch("agentz.workflows.handlers.authichain_executive_reporting.generate_scale_up_report", new_callable=AsyncMock)
@patch("agentz.workflows.handlers.authichain_executive_reporting.qualified_opportunities", return_value=[])
@patch("agentz.workflows.handlers.authichain_executive_reporting.get_all_deals")
def test_real_deal_gets_honest_zero_metrics_not_fabricated_ones(
    mock_get_deals, mock_qual, mock_scale, mock_muni, mock_roi, mock_save, mock_load, mock_unload
):
    mock_get_deals.return_value = [{"id": "1", "name": "Real Named Company", "amount": "5000"}]
    mock_scale.return_value = "scale report"
    mock_muni.return_value = "muni proposal"
    mock_roi.return_value = "roi report"

    handler.run(make_ctx())

    brand_arg, metrics_arg = mock_roi.call_args.args
    assert brand_arg == "Real Named Company"
    assert metrics_arg["scans"] == 0
    assert metrics_arg["rewards"] == 0
    assert "no" in metrics_arg["retention"].lower() or metrics_arg["retention"] == "N/A"
