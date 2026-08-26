"""
Regression tests for agentz.core.closer.

Prior bugs:
1. check_demo_viewed() always returned True with no real signal source,
   so run_closing_loop() attempted to autonomously close every HubSpot
   deal regardless of any actual engagement.
2. send_closing_package() picked an agreement file by glob-matching the
   deal's name against filenames, falling back to a generic default --
   the same filename-guessing anti-pattern already fixed once in
   docusign_blitz.py, just not applied here too.
"""
from __future__ import annotations

from unittest.mock import patch, AsyncMock

import pytest

from agentz.core import closer


@pytest.mark.asyncio
async def test_check_demo_viewed_fails_closed_with_no_real_signal_source():
    # No microsite_analytics table/mechanism exists yet -- must not
    # fabricate a "yes" signal.
    assert await closer.check_demo_viewed("any-deal-id") is False


@pytest.mark.asyncio
async def test_send_closing_package_uses_the_agreements_own_recipient_not_deal_data_email(tmp_path):
    agreement = tmp_path / "acme.md"
    agreement.write_text("recipient: real.contact@acme.com\n\nAgreement body.\n", encoding="utf-8")

    with patch("agentz.core.closer.create_stripe_payment_link", new=AsyncMock(return_value={"url": "https://stripe.test/pay"})), \
         patch("agentz.core.closer.create_envelope_from_markdown", new=AsyncMock(return_value={"envelope_id": "env_123"})) as mock_envelope:
        result = await closer.send_closing_package(
            supabase=None,
            deal_data={"id": "42", "name": "Acme Corp", "email": "wrong-guessed@acme-corp-guessed.com"},
            agreement_path=str(agreement),
        )

    mock_envelope.assert_awaited_once_with(str(agreement), "real.contact@acme.com")
    assert result["package_sent"] is True


@pytest.mark.asyncio
async def test_send_closing_package_skips_when_agreement_has_no_recipient(tmp_path):
    agreement = tmp_path / "no_recipient.md"
    agreement.write_text("No frontmatter here.\n", encoding="utf-8")

    with patch("agentz.core.closer.create_stripe_payment_link", new=AsyncMock()) as mock_stripe, \
         patch("agentz.core.closer.create_envelope_from_markdown", new=AsyncMock()) as mock_envelope:
        result = await closer.send_closing_package(
            supabase=None,
            deal_data={"id": "42", "name": "Acme Corp"},
            agreement_path=str(agreement),
        )

    mock_stripe.assert_not_awaited()
    mock_envelope.assert_not_awaited()
    assert result["package_sent"] is False


@pytest.mark.asyncio
async def test_run_closing_loop_does_nothing_without_an_explicit_agreement_path():
    with patch("agentz.core.hubspot.get_all_deals", new=AsyncMock(return_value=[{"id": "1", "name": "Deal"}])):
        closings = await closer.run_closing_loop(supabase=None)

    assert closings == []
