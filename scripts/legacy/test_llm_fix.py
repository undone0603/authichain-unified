import asyncio
import logging
import pytest
from agentz.core.llm import get_llm

@pytest.mark.asyncio
async def test_limit_proof_llm():
    logging.basicConfig(level=logging.INFO)
    print("--- Testing Limit-Proof LLM Tool Binding ---")
    
    # 1. Initialize with tool-calling simulation
    llm = get_llm(model="limit-proof")
    
    mock_tools = [{"name": "get_weather", "description": "Get the weather"}]
    
    # browser-use calls bind_tools
    bound_llm = llm.bind_tools(mock_tools)
    
    print(f"Bound LLM Type: {type(bound_llm)}")
    
    # 2. Simulate invocation (this will trigger the waterfall)
    try:
        # We use a simple prompt. In a real failover, it would try OpenAI, then Gemini, etc.
        # Since keys are missing/invalid, it should eventually fail but we want to see the sequence.
        response = await bound_llm.ainvoke("What is the weather in Detroit?")
        print(f"Response: {response}")
    except Exception as e:
        print(f"Final Failure as expected: {e}")

if __name__ == "__main__":
    asyncio.run(test_limit_proof_llm())
