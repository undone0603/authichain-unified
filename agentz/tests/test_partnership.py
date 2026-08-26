"""
Regression tests for agentz.core.partnership.

Prior bug: scout_strategic_partners ran a real browser-use search but then
discarded its result entirely, unconditionally returning two hardcoded fake
leads naming real companies (DHL Supply Chain Solutions, Lloyd's of
London). draft_partnership_proposal would then draft real outreach to
whichever fake/real lead it was given.
"""
from __future__ import annotations

from unittest.mock import patch, AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_returns_the_real_browser_search_result_not_hardcoded_fake_leads():
    fake_history = MagicMock()
    fake_history.final_result.return_value = (
        '[{"name": "Real Freight Co", "type": "Logistics", "lead_url": "https://realfreight.example.com"}]'
    )

    with patch("browser_use.Agent") as mock_agent_cls, \
         patch("browser_use.Controller"), \
         patch("agentz.core.llm.get_llm"), \
         patch("agentz.core.browser.run_with_healing", new=AsyncMock(return_value=fake_history)):
        mock_agent_cls.return_value.run = AsyncMock(return_value=fake_history)

        from agentz.core.partnership import scout_strategic_partners
        from agentz.core.modes import ExecutionContext, Mode

        ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test-partnership", verbose=False)
        result = await scout_strategic_partners("luxury", ctx)

    assert result == [{"name": "Real Freight Co", "type": "Logistics", "lead_url": "https://realfreight.example.com"}]
    names = [r["name"] for r in result]
    assert "DHL Supply Chain Solutions" not in names
    assert "Lloyd's of London (Fine Art & Specie)" not in names


@pytest.mark.asyncio
async def test_returns_empty_list_when_the_real_result_cannot_be_parsed():
    fake_history = MagicMock()
    fake_history.final_result.return_value = "not valid json at all"

    with patch("browser_use.Agent") as mock_agent_cls, \
         patch("browser_use.Controller"), \
         patch("agentz.core.llm.get_llm"), \
         patch("agentz.core.browser.run_with_healing", new=AsyncMock(return_value=fake_history)):
        mock_agent_cls.return_value.run = AsyncMock(return_value=fake_history)

        from agentz.core.partnership import scout_strategic_partners
        from agentz.core.modes import ExecutionContext, Mode

        ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test-partnership", verbose=False)
        result = await scout_strategic_partners("luxury", ctx)

    # Fails closed: no result, not a fabricated fallback.
    assert result == []
