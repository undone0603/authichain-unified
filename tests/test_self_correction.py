# tests/test_self_correction.py
import pytest
import asyncio
from unittest.mock import MagicMock
import agentz.core.grants as grants

@pytest.mark.asyncio
async def test_draft_federal_proposal_multi_pass(monkeypatch):
    # 1. Mock the LLM to return different responses for each call
    call_responses = [
        MagicMock(content="Initial Draft Content"),   # Call 1: Draft
        MagicMock(content="- Missing Section X"),      # Call 2: Critic
        MagicMock(content="Final Refined Content")     # Call 3: Refine
    ]
    
    call_index = 0
    def mock_invoke(prompt):
        nonlocal call_index
        res = call_responses[call_index]
        call_index += 1
        return res

    mock_llm = MagicMock()
    mock_llm.invoke = mock_invoke
    
    # Patch get_llm to return our mock
    monkeypatch.setattr("agentz.core.grants.get_llm", lambda **kw: mock_llm)

    # 2. Execute
    grant_data = {
        "title": "Secure Logistics",
        "agency": "DOD",
        "deadline": "2030-01-01",
        "notice_id": "test-123"
    }
    
    result = await grants.draft_federal_proposal(grant_data)

    # 3. Verify
    assert result == "Final Refined Content"
    assert call_index == 3 # Confirmed all 3 passes were executed
