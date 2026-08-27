import pytest
from unittest.mock import MagicMock
from agentz.core.specialists import ConversionOptimizerSpecialist
from agentz.core.outreach import tune_outreach_prompt
import os

def test_optimizer_identifies_bottleneck():
    optimizer = ConversionOptimizerSpecialist()
    # Mock data showing high drop-off at open rate
    funnel_data = [
        {"stage": "proposal_sent"},
        {"stage": "proposal_sent"},
        {"stage": "proposal_sent"},
        {"stage": "email_opened"}
    ]
    
    result = optimizer.assess(funnel_data)
    print(f"DEBUG: findings={result.findings}")
    assert len(result.findings) > 0
    assert result.findings[0] == "Open rate below 50% — subject line optimization suggested"
    assert result.recommended_actions[0]['suggestion'] == "Test shorter, curiosity-driven subject lines"

def test_prompt_tuner_updates_template(monkeypatch):
    # Setup mock for persistence
    mock_persist = MagicMock()
    monkeypatch.setattr("agentz.core.outreach.persist_new_prompt", mock_persist)
    monkeypatch.setattr("agentz.core.outreach.get_current_prompt", lambda: "Base prompt")
    
    tune_outreach_prompt({"suggestion": "Test shorter subject lines"})
    
    mock_persist.assert_called_once()
    assert "Test shorter subject lines" in mock_persist.call_args[0][0]
