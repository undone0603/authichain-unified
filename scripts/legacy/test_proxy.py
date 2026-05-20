import asyncio
from browser_use import Agent
from langchain_openai import ChatOpenAI

class LLMProxy:
    def __init__(self, llm):
        self._llm = llm
        
    def __getattr__(self, name):
        if name == "provider":
            return "openai"
        if name == "model":
            return getattr(self._llm, "model_name", "unknown")
        return getattr(self._llm, name)

async def main():
    llm = ChatOpenAI(model='gpt-4o', api_key='test')
    proxy = LLMProxy(llm)
    agent = Agent(task='test', llm=proxy)
    print("Agent created!")

if __name__ == "__main__":
    asyncio.run(main())