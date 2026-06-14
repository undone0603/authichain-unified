# tests/test_hubspot_token.py
import pytest
import httpx
import asyncio
from pathlib import Path
from agentz.core.modes import ExecutionContext, Mode
from agentz.core import hubspot
import agentz.core.credentials as creds

@pytest.mark.asyncio
async def test_hubspot_auto_heals_on_401(monkeypatch):
    # 1. Setup mock credentials and environment
    # hubspot.py does `from agentz.core.credentials import get`, so the name must
    # be patched in the hubspot module namespace (patching creds.get has no effect).
    mock_get = lambda k, **kw: "old_token" if k == "hubspot_token" else "mock_val"
    monkeypatch.setattr(creds, "get", mock_get)
    monkeypatch.setattr(hubspot, "get", mock_get)
    
    updates = []
    def mock_update(key, value):
        updates.append((key, value))
        return True
    monkeypatch.setattr(hubspot, "update_credential", mock_update)

    # 2. Mock the HubSpot API to return 401 then 200
    call_count = 0
    class MockResponse:
        def __init__(self, status_code, json_data):
            self.status_code = status_code
            self._json = json_data
        def json(self): return self._json

    async def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return MockResponse(401, {"message": "Unauthorized"})
        return MockResponse(200, {"results": [{"id": "d1", "properties": {"dealname": "Healed Deal"}}], "paging": {}})

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    # 3. Mock the Token Healer
    async def mock_rotate():
        return "new_healed_token"
    monkeypatch.setattr("agentz.core.hubspot.rotate_hubspot_token", mock_rotate)

    # 4. Execute
    deals = await hubspot.get_all_deals(limit=1)

    # 5. Verify
    assert len(deals) == 1
    assert deals[0]["name"] == "Healed Deal"
    assert call_count == 2
    assert ("hubspot_token", "new_healed_token") in updates
