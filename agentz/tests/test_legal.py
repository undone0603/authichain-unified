"""
Regression tests for agentz.core.legal.

Prior bug: scout_marketplace_infringement ran a real browser-use search
but discarded its result, unconditionally returning two hardcoded fake
eBay/Amazon "infringement" listings. draft_enforcement_notice would then
draft a real Cease & Desist letter based on that fabricated data.
"""
from __future__ import annotations

from unittest.mock import patch, AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_returns_the_real_browser_search_result_not_hardcoded_fake_listings():
    fake_history = MagicMock()
    fake_history.final_result.return_value = (
        '[{"url": "https://ebay.com/itm/real-listing-789", "seller": "RealSeller", "issue": "Real issue found"}]'
    )

    with patch("browser_use.Agent") as mock_agent_cls, \
         patch("browser_use.Controller"), \
         patch("agentz.core.llm.get_llm"), \
         patch("agentz.core.browser.run_with_healing", new=AsyncMock(return_value=fake_history)):
        mock_agent_cls.return_value.run = AsyncMock(return_value=fake_history)

        from agentz.core.legal import scout_marketplace_infringement
        from agentz.core.modes import ExecutionContext, Mode

        ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test-legal", verbose=False)
        result = await scout_marketplace_infringement("AuthiChain", ctx)

    assert result == [{"url": "https://ebay.com/itm/real-listing-789", "seller": "RealSeller", "issue": "Real issue found"}]
    urls = [r["url"] for r in result]
    assert "https://ebay.com/itm/fake-123" not in urls
    assert "https://amazon.com/scam-456" not in urls


@pytest.mark.asyncio
async def test_returns_empty_list_when_the_real_result_cannot_be_parsed():
    fake_history = MagicMock()
    fake_history.final_result.return_value = "not valid json at all"

    with patch("browser_use.Agent") as mock_agent_cls, \
         patch("browser_use.Controller"), \
         patch("agentz.core.llm.get_llm"), \
         patch("agentz.core.browser.run_with_healing", new=AsyncMock(return_value=fake_history)):
        mock_agent_cls.return_value.run = AsyncMock(return_value=fake_history)

        from agentz.core.legal import scout_marketplace_infringement
        from agentz.core.modes import ExecutionContext, Mode

        ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="test-legal", verbose=False)
        result = await scout_marketplace_infringement("AuthiChain", ctx)

    assert result == []
