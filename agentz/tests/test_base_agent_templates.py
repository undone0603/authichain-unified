"""
Regression tests for agentz.agents.base's DETERMINISTIC_TEMPLATES.

Prior bug: DETERMINISTIC_TEMPLATES short-circuited BaseAgent.run() before
ever calling the real LLM ("to save LLM tokens/latency") for any agent
named DRAFT_OUTBOUND_EMAIL, always returning a hardcoded fake cold email
that names a fictional "Michael" at the real company Medtronic and
invents specific claims (a $400K risk figure). The agent's own real
prompt (in agents/pipeline.py) is generic and makes no such claims --
the template bypass silently replaced it every time.
"""
from __future__ import annotations

from unittest.mock import MagicMock

from agentz.agents.base import DETERMINISTIC_TEMPLATES
from agentz.agents.pipeline import DraftOutboundEmailAgent


def test_no_fabricated_real_company_content_remains_in_deterministic_templates():
    for name, content in DETERMINISTIC_TEMPLATES.items():
        assert "Medtronic" not in content, f"{name} still fabricates claims about a real company"
        assert "Stryker" not in content
        assert "Abbott" not in content


def test_draft_outbound_email_agent_actually_calls_the_llm_not_a_canned_template():
    client = MagicMock()
    client.chat.return_value = '{"output": "A real, freshly-drafted email.", "ok": true}'

    agent = DraftOutboundEmailAgent(client)
    result = agent.run()

    client.chat.assert_called_once()
    assert result.output == "A real, freshly-drafted email."
    assert "Medtronic" not in result.output
