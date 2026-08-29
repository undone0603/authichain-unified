import asyncio
from unittest.mock import MagicMock
from agentz.core.reputation import update_agent_reputation

async def test_reputation_update():
    # Mock Supabase client
    supabase = MagicMock()
    
    # Mock return values for fetch
    supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = [
        MagicMock(data={'id': 1, 'agent_id': 1, 'status': 'success', 'confidence': 80}), # claim
        MagicMock(data={'id': 1, 'reputation_score': 50}) # agent
    ]
    
    # Mock return value for update
    supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    
    new_score = await update_agent_reputation(supabase, 1, 1)
    print(f"New score: {new_score}")
    assert new_score == 58.0

if __name__ == '__main__':
    asyncio.run(test_reputation_update())
