"""
Regression tests for agentz.workflows.handlers.authichain_worker_outreach.

Prior bug: the handler fabricated each lead's contact email as
`contact@{slug}.com` (a made-up address for a real company) instead of
calling agentz.core.hubspot.get_lead_contact_info, which already does a
real HubSpot lookup. These tests assert the real lookup is used and that
leads without a verified contact are skipped rather than sent to a
fabricated address.
"""
from __future__ import annotations

from unittest.mock import patch, AsyncMock

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import authichain_worker_outreach as handler


def make_ctx() -> ExecutionContext:
    return ExecutionContext(mode=Mode.AUTO, workflow_id="test-worker-outreach", verbose=False)


@patch.object(handler.lm_manager, "unload_model")
@patch.object(handler.lm_manager, "load_model")
@patch("agentz.workflows.handlers.authichain_worker_outreach.OutreachEngineClient")
@patch("agentz.workflows.handlers.authichain_worker_outreach.get_lead_contact_info")
@patch("agentz.workflows.handlers.authichain_worker_outreach.get_hot_leads")
def test_uses_real_contact_email_not_fabricated_one(
    mock_get_hot_leads, mock_get_contact, mock_client_cls, mock_load, mock_unload
):
    mock_get_hot_leads.return_value = [{"id": "1", "name": "Real Company Inc", "slug": "real-company-inc"}]
    mock_get_contact.return_value = {"email": "vp.supplychain@realcompany.com", "name": "Jane Doe"}

    mock_client = mock_client_cls.return_value
    mock_client.add_lead = AsyncMock(return_value=True)
    mock_client.trigger_batch = AsyncMock(return_value={"ok": True})

    handler.run(make_ctx())

    synced_payload = mock_client.add_lead.call_args.args[0]
    assert synced_payload["contact_email"] == "vp.supplychain@realcompany.com"
    assert synced_payload["contact_name"] == "Jane Doe"
    assert "@real-company-inc.com" not in synced_payload["contact_email"]


@patch.object(handler.lm_manager, "unload_model")
@patch.object(handler.lm_manager, "load_model")
@patch("agentz.workflows.handlers.authichain_worker_outreach.OutreachEngineClient")
@patch("agentz.workflows.handlers.authichain_worker_outreach.get_lead_contact_info")
@patch("agentz.workflows.handlers.authichain_worker_outreach.get_hot_leads")
def test_skips_lead_with_no_verified_contact_instead_of_fabricating_one(
    mock_get_hot_leads, mock_get_contact, mock_client_cls, mock_load, mock_unload
):
    mock_get_hot_leads.return_value = [{"id": "2", "name": "No Contact Co", "slug": "no-contact-co"}]
    mock_get_contact.return_value = None  # no real contact found in HubSpot

    mock_client = mock_client_cls.return_value
    mock_client.add_lead = AsyncMock(return_value=True)
    mock_client.trigger_batch = AsyncMock(return_value={"ok": True})

    result = handler.run(make_ctx())

    mock_client.add_lead.assert_not_called()
    assert "0 synced" in result.lower() or "skipped" in result.lower()
